import uuid
import logging
import time
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.db.models.user import User
from app.db.models.chat import ChatThread, ChatMessage
from app.db.models.feedback import MessageFeedback
from app.db.models.knowledge import KnowledgeBaseChunk
from app.schemas.chat import (
    MessageSendRequest,
    MessageResponse,
    ThreadDetailResponse,
    MessageFeedbackCreate,
    MessageFeedbackResponse,
    AIMetricsResponse,
    CurateFeedbackRequest
)
from app.services.lgpd_service import anonymize_medical_text
from app.ai.emotion_analyzer import classify_emotion
from app.ai.rag_engine import retrieve_relevant_medical_context, format_rag_context_for_prompt
from app.ai.prompts import SYSTEM_PROMPT_DOUTORA_ROSA, MANDATORY_MEDICAL_DISCLAIMER, clean_rosa_text
from app.ai.client import generate_text_embedding
from app.ai import llm, safety, monitoring
from app.core.config import settings

logger = logging.getLogger("rosaia.chat")
router = APIRouter(prefix="/chat", tags=["Atendimento Humanizado & Doutora Rosa"])


def format_date_group(dt: datetime) -> str:
    """Formata o cabeçalho de grupo de datas estilo WhatsApp."""
    now = datetime.now(timezone.utc)
    if dt.date() == now.date():
        return "Hoje"
    meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]
    return f"{dt.day:02d} de {meses[dt.month - 1]} de {dt.year}"


def serialize_chat_message(msg: ChatMessage, user_rating: Optional[int] = None) -> MessageResponse:
    """Converte o modelo ORM ChatMessage no DTO MessageResponse com telemetria."""
    dt = msg.created_at
    time_str = dt.strftime("%H:%M")
    date_group_str = format_date_group(dt)
    sender = "doutora_rosa" if msg.sender_type in ("doutora_rosa", "assistant", "bot") else "user"

    rag_refs = []
    if isinstance(msg.rag_references, list):
        rag_refs = [str(r) for r in msg.rag_references]

    return MessageResponse(
        id=str(msg.id),
        date_group=date_group_str,
        time=time_str,
        sender=sender,
        text=msg.content,
        emotion_tag=msg.detected_emotion,
        doc_attachment=str(msg.attached_document_id) if msg.attached_document_id else None,
        psychological_support_triggered=bool(msg.psychological_support_triggered),
        rag_references=rag_refs,
        created_at=msg.created_at,
        ai_model=getattr(msg, "ai_model", None),
        used_fallback=bool(getattr(msg, "used_fallback", False)),
        urgency_level=getattr(msg, "urgency_level", "none") or "none",
        user_rating=user_rating,
    )


async def get_or_create_active_thread(user_id: uuid.UUID, db: AsyncSession) -> ChatThread:
    """
    Recupera a conversa contínua mais recente da paciente ou inicializa uma nova.
    """
    stmt = (
        select(ChatThread)
        .where(ChatThread.user_id == user_id, ChatThread.is_archived.is_(False))
        .order_by(ChatThread.last_message_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    thread = result.scalar_one_or_none()
    if not thread:
        thread = ChatThread(
            user_id=user_id,
            title="Conversa com a Doutora Rosa",
            current_emotional_state="acolhimento_inicial"
        )
        db.add(thread)
        await db.commit()
        await db.refresh(thread)
    return thread


@router.get(
    "/messages",
    response_model=ThreadDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Histórico contínuo de mensagens da paciente estilo WhatsApp"
)
async def get_chat_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna o histórico cronológico de mensagens com ratings prévios da usuária.
    """
    thread = await get_or_create_active_thread(current_user.id, db)

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.thread_id == thread.id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()

    # Busca ratings que a usuária já deu nessa thread
    msg_ids = [m.id for m in messages if m.sender_type in ("doutora_rosa", "assistant")]
    ratings_map = {}
    if msg_ids:
        fb_stmt = select(MessageFeedback.message_id, MessageFeedback.rating).where(
            MessageFeedback.message_id.in_(msg_ids),
            MessageFeedback.user_id == current_user.id
        )
        fb_res = await db.execute(fb_stmt)
        ratings_map = {row[0]: row[1] for row in fb_res.all()}

    return ThreadDetailResponse(
        thread_id=str(thread.id),
        title=thread.title,
        current_emotional_state=thread.current_emotional_state,
        messages=[serialize_chat_message(m, ratings_map.get(m.id)) for m in messages]
    )


@router.post(
    "/send",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Envio de mensagem à Dra. Rosa com memória conversacional, RAG, NLU e guardrails"
)
async def send_message(
    payload: MessageSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Processa a mensagem da paciente com o motor cognitivo:
    1. Higieniza dados de PII (anonimização LGPD).
    2. Avalia sinais de alerta e urgência clínica (guardrail).
    3. Analisa estado emocional com LLM estruturado (fallback em regras).
    4. Carrega histórico recente da conversa (memória contextual).
    5. Recupera contexto científico no pgvector (RAG de 768-dim).
    6. Gera resposta empática e segura com Gemini via wrapper resiliente com retries e timeout.
    7. Valida a resposta com guardrails clínicos e injeta avisos necessários.
    8. Persiste a telemetria da IA para melhoria contínua.
    """
    start_time = time.perf_counter()
    thread = await get_or_create_active_thread(current_user.id, db)

    # 1. Anonimização LGPD preventiva
    sanitized_user_message = anonymize_medical_text(payload.content)

    # 2. Triagem de urgência clínica (guardrails de segurança)
    urgency = safety.assess_urgency(sanitized_user_message)

    # 3. Análise emocional (LLM com fallback em regras)
    emotion = await classify_emotion(sanitized_user_message)
    thread.current_emotional_state = emotion["sentiment"]
    thread.last_message_at = datetime.now(timezone.utc)

    # 4. Recuperação de evidências médicas RAG via pgvector
    rag_contexts = await retrieve_relevant_medical_context(sanitized_user_message, db=db, top_k=3)
    rag_text = format_rag_context_for_prompt(rag_contexts)
    rag_titles = [f"{c.get('title')} ({c.get('source')})" for c in rag_contexts]

    # Salva mensagem da usuária no banco
    user_msg_record = ChatMessage(
        thread_id=thread.id,
        sender_type="user",
        content=sanitized_user_message,
        detected_emotion=emotion["sentiment"],
        psychological_support_triggered=emotion["psychological_support_triggered"],
        attached_document_id=payload.attached_document_id,
        rag_references=[],
        urgency_level=urgency.level,
        emotion_source=emotion.get("source", "rules"),
    )
    db.add(user_msg_record)
    await db.flush()

    # 5. Memória conversacional: busca as últimas N mensagens da thread
    history_limit = max(2, int(settings.CHAT_HISTORY_MESSAGES))
    hist_stmt = (
        select(ChatMessage)
        .where(
            ChatMessage.thread_id == thread.id,
            ChatMessage.id != user_msg_record.id
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(history_limit)
    )
    hist_res = await db.execute(hist_stmt)
    previous_messages = list(reversed(hist_res.scalars().all()))

    turns: List[Tuple[str, str]] = []
    for prev in previous_messages:
        role = "user" if prev.sender_type == "user" else "model"
        turns.append((role, prev.content))

    # Constrói o turno atual com contexto de apoio e evidências RAG
    current_prompt_parts = []
    if rag_text:
        current_prompt_parts.append(rag_text)
    current_prompt_parts.append(
        f"[SINALIZADOR EMOCIONAL: Apoio Psicológico Ativado={emotion['psychological_support_triggered']}, "
        f"Grau de Ansiedade={emotion['sentiment']}]"
    )

    # Diretiva especial para triagem e memória contextual
    is_triage_msg = "triagem de atenção mamária" in sanitized_user_message.lower() or "resultado da triagem" in sanitized_user_message.lower()
    if is_triage_msg:
        current_prompt_parts.append(
            "[DIRETIVA DE TRIAGEM: A usuária está submetendo sua Triagem de Atenção Mamária. "
            "Responda com calor humano, empatia e de forma altamente específica baseando-se nas informações desta triagem. "
            "Se a usuária fizer perguntas ou mencionar tópicos conversados antes da triagem, integre e lembre perfeitamente dos contextos anteriores. "
            "NUNCA utilize asteriscos (*) ou hashtags (#) em sua resposta.]"
        )
    else:
        current_prompt_parts.append(
            "[DIRETIVA DE RESPOSTA E MEMÓRIA: Mantenha gerenciamento completo da memória contextual. "
            "Se a paciente mencionar assuntos passados (como exames anteriores, laudos ou triagens), "
            "lembre, correlacione e gerencie múltiplos contextos perfeitamente. NUNCA utilize asteriscos (*) ou hashtags (#).]"
        )

    if urgency.prompt_directive:
        current_prompt_parts.append(urgency.prompt_directive)
    current_prompt_parts.append(f"Pergunta da Paciente: {sanitized_user_message}")

    turns.append(("user", "\n\n".join(current_prompt_parts)))

    # 6. Geração com LLM resiliente
    assistant_reply = ""
    used_fallback = False
    ai_model_used = None
    prompt_tokens = None
    completion_tokens = None

    try:
        llm_result = await llm.generate(
            system_instruction=SYSTEM_PROMPT_DOUTORA_ROSA,
            turns=turns,
            temperature=0.4,
            purpose="chat_reply",
        )
        assistant_reply = llm_result.text
        ai_model_used = llm_result.model
        prompt_tokens = llm_result.prompt_tokens
        completion_tokens = llm_result.completion_tokens
    except llm.LLMUnavailableError as exc:
        logger.error("LLM indisponível para chat, ativando contingência: %s", exc)
        used_fallback = True
        monitoring.incr("fallback_responses")

    # 7. Resposta de contingência caso o LLM falhe
    if not assistant_reply:
        if emotion["psychological_support_triggered"]:
            assistant_reply = (
                "Olá, querida. Eu compreendo profundamente o quanto sentir uma alteração ou ter dúvidas sobre a saúde da mama "
                "pode trazer medo e insegurança. Quero que respire fundo e lembre-se de que estamos juntas nesta jornada.\n\n"
                "A ciência e os dados do INCA e da Sociedade Brasileira de Mastologia nos mostram com clareza que cerca de 80% das alterações que encontramos "
                "nas mamas são completamente benignas, como cistos e fibroadenomas. Além disso, quando investigamos precocemente, "
                "as chances de cura superam 95%.\n\n"
                "Você não está sozinha. O melhor passo agora é mantermos a calma e agendarmos uma consulta presencial com "
                "seu médico mastologista ou na Unidade Básica de Saúde para que ele examine você com todo o carinho e cuidado."
            )
        else:
            assistant_reply = (
                "Olá! Fico muito feliz em conversar com você e esclarecer suas dúvidas sobre a saúde das mamas. "
                "A informação correta e o autocuidado são nossos maiores aliados na prevenção. Lembre-se sempre de manter seus "
                "exames de rotina atualizados conforme a recomendação do seu médico."
            )

    # 8. Validação de guardrails clínicos sobre a resposta gerada
    violations = safety.validate_reply(assistant_reply)
    if violations:
        logger.warning("Resposta da IA violou guardrails clínicos (%s). Substituindo por resposta segura.", violations)
        assistant_reply = safety.SAFE_REPLY_AFTER_VIOLATION

    # 9. Injeta aviso de urgência no topo (se aplicável)
    assistant_reply = safety.prepend_notice(assistant_reply, urgency)

    # 10. Garantia incondicional do aviso médico obrigatório (RNF13)
    if MANDATORY_MEDICAL_DISCLAIMER not in assistant_reply:
        assistant_reply = f"{assistant_reply}\n\n{MANDATORY_MEDICAL_DISCLAIMER}"

    # 11. Padronização estrita de formatação da Doutora Rosa (remoção de * e #)
    assistant_reply = clean_rosa_text(assistant_reply)

    latency_ms = int((time.perf_counter() - start_time) * 1000)

    # Salva resposta da Dra. Rosa no banco com telemetria
    bot_msg_record = ChatMessage(
        thread_id=thread.id,
        sender_type="doutora_rosa",
        content=assistant_reply,
        detected_emotion=emotion["sentiment"],
        psychological_support_triggered=emotion["psychological_support_triggered"],
        rag_references=rag_titles,
        response_latency_ms=latency_ms,
        ai_model=ai_model_used,
        used_fallback=used_fallback,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        urgency_level=urgency.level,
        emotion_source=emotion.get("source", "rules"),
    )
    db.add(bot_msg_record)
    await db.commit()
    await db.refresh(bot_msg_record)

    return serialize_chat_message(bot_msg_record)


@router.post(
    "/messages/{message_id}/feedback",
    response_model=MessageFeedbackResponse,
    status_code=status.HTTP_200_OK,
    summary="Avaliação (👍/👎) da usuária sobre a resposta com consentimento LGPD para treino"
)
async def submit_message_feedback(
    message_id: uuid.UUID,
    payload: MessageFeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Permite que a paciente avalie uma resposta da Doutora Rosa (1 para positivo, -1 para negativo),
    comentário opcional anonimizado e consentimento explícito LGPD para melhoria do modelo.
    """
    stmt = select(ChatMessage).where(ChatMessage.id == message_id)
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mensagem não encontrada.")

    # Higieniza comentário se houver
    clean_comment = anonymize_medical_text(payload.comment) if payload.comment else None

    # Upsert feedback
    fb_stmt = select(MessageFeedback).where(
        MessageFeedback.message_id == message_id,
        MessageFeedback.user_id == current_user.id
    )
    fb_res = await db.execute(fb_stmt)
    feedback = fb_res.scalar_one_or_none()

    if feedback:
        feedback.rating = payload.rating
        feedback.comment = clean_comment
        feedback.allow_training_use = payload.allow_training_use
    else:
        feedback = MessageFeedback(
            message_id=message_id,
            user_id=current_user.id,
            rating=payload.rating,
            comment=clean_comment,
            allow_training_use=payload.allow_training_use,
            review_status="pending"
        )
        db.add(feedback)

    await db.commit()
    await db.refresh(feedback)

    return MessageFeedbackResponse(
        id=str(feedback.id),
        message_id=str(feedback.message_id),
        rating=feedback.rating,
        comment=feedback.comment,
        allow_training_use=feedback.allow_training_use,
        review_status=feedback.review_status,
        created_at=feedback.created_at
    )


@router.get(
    "/metrics",
    response_model=AIMetricsResponse,
    status_code=status.HTTP_200_OK,
    summary="Métricas de observabilidade, satisfação e resiliência da IA"
)
async def get_ai_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna indicadores de qualidade: taxa de satisfação, taxa de fallback,
    latência média e volume de fragmentos na base de conhecimento.
    """
    # Total de mensagens da assistente
    total_msgs_stmt = select(func.count(ChatMessage.id)).where(
        ChatMessage.sender_type.in_(("doutora_rosa", "assistant"))
    )
    total_msgs = (await db.execute(total_msgs_stmt)).scalar() or 0

    # Mensagens que usaram fallback
    fallback_stmt = select(func.count(ChatMessage.id)).where(
        ChatMessage.sender_type.in_(("doutora_rosa", "assistant")),
        ChatMessage.used_fallback.is_(True)
    )
    total_fallback = (await db.execute(fallback_stmt)).scalar() or 0

    # Latência média
    avg_latency_stmt = select(func.avg(ChatMessage.response_latency_ms)).where(
        ChatMessage.sender_type.in_(("doutora_rosa", "assistant")),
        ChatMessage.response_latency_ms.isnot(None)
    )
    avg_latency = float((await db.execute(avg_latency_stmt)).scalar() or 0.0)

    # Feedbacks
    total_fb_stmt = select(func.count(MessageFeedback.id))
    pos_fb_stmt = select(func.count(MessageFeedback.id)).where(MessageFeedback.rating > 0)
    neg_fb_stmt = select(func.count(MessageFeedback.id)).where(MessageFeedback.rating < 0)

    total_fb = (await db.execute(total_fb_stmt)).scalar() or 0
    pos_fb = (await db.execute(pos_fb_stmt)).scalar() or 0
    neg_fb = (await db.execute(neg_fb_stmt)).scalar() or 0

    sat_rate = (pos_fb / total_fb * 100.0) if total_fb > 0 else 100.0
    fb_rate = (total_fallback / total_msgs * 100.0) if total_msgs > 0 else 0.0

    # Base RAG
    active_kb_stmt = select(func.count(KnowledgeBaseChunk.id)).where(KnowledgeBaseChunk.is_active.is_(True))
    curated_kb_stmt = select(func.count(KnowledgeBaseChunk.id)).where(
        KnowledgeBaseChunk.is_active.is_(True),
        KnowledgeBaseChunk.origin == "curated"
    )
    active_kb = (await db.execute(active_kb_stmt)).scalar() or 0
    curated_kb = (await db.execute(curated_kb_stmt)).scalar() or 0

    return AIMetricsResponse(
        total_messages=total_msgs,
        total_feedbacks=total_fb,
        positive_feedbacks=pos_fb,
        negative_feedbacks=neg_fb,
        satisfaction_rate=round(sat_rate, 1),
        fallback_rate=round(fb_rate, 1),
        avg_latency_ms=round(avg_latency, 1),
        active_kb_chunks=active_kb,
        curated_kb_chunks=curated_kb
    )


@router.post(
    "/feedback/{feedback_id}/curate",
    status_code=status.HTTP_200_OK,
    summary="Curadoria médica: aprovação e promoção de resposta curada para o RAG"
)
async def curate_feedback(
    feedback_id: uuid.UUID,
    payload: CurateFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fluxo de melhoria contínua da IA por humanos:
    Médico/auditor revisa uma mensagem avaliada negativamente ou com dúvida e
    insere a resposta ouro ('curated_answer'), promovendo-a para a base RAG se desejado.
    """
    allowed_roles = settings.REVIEWER_ROLES
    if isinstance(allowed_roles, str):
        allowed_roles = [r.strip() for r in allowed_roles.split(",")]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito à equipe clínica e de curadoria."
        )

    stmt = select(MessageFeedback).where(MessageFeedback.id == feedback_id)
    fb = (await db.execute(stmt)).scalar_one_or_none()
    if not fb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro de feedback não encontrado.")

    fb.review_status = payload.review_status
    fb.curated_answer = payload.curated_answer
    fb.reviewer_notes = payload.reviewer_notes
    fb.reviewer_id = current_user.id
    fb.reviewed_at = datetime.now(timezone.utc)

    # Se promoção solicitada, indexa como chunk curado no RAG
    if payload.promote_to_kb and payload.curated_answer:
        # Busca a mensagem original da usuária
        msg_stmt = select(ChatMessage).where(ChatMessage.id == fb.message_id)
        msg_record = (await db.execute(msg_stmt)).scalar_one_or_none()
        topic_title = f"Orientação Curada Dra. Rosa ({current_user.full_name[:30]})"

        emb = await generate_text_embedding(
            f"{topic_title}\n{payload.curated_answer}",
            task_type="RETRIEVAL_DOCUMENT"
        )
        kb_chunk = KnowledgeBaseChunk(
            title=topic_title,
            source_institution=f"Curadoria Clínica UNICEPLAC ({current_user.full_name})",
            topic_category="apoio_psicologico",
            content_text=payload.curated_answer,
            embedding=emb,
            origin="curated",
            is_active=True
        )
        db.add(kb_chunk)
        await db.flush()
        fb.kb_chunk_id = kb_chunk.id
        fb.review_status = "promoted"

    await db.commit()
    return {"message": "Curadoria registrada com sucesso.", "status": fb.review_status}
