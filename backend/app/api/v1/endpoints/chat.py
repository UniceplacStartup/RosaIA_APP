import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.db.models.user import User
from app.db.models.chat import ChatThread, ChatMessage
from app.schemas.chat import MessageSendRequest, MessageResponse, ThreadDetailResponse
from app.services.lgpd_service import anonymize_medical_text
from app.ai.emotion_analyzer import analyze_emotional_state
from app.ai.rag_engine import retrieve_relevant_medical_context, format_rag_context_for_prompt
from app.ai.prompts import SYSTEM_PROMPT_DOUTORA_ROSA, MANDATORY_MEDICAL_DISCLAIMER
from app.ai.client import get_genai_client
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


def serialize_chat_message(msg: ChatMessage) -> MessageResponse:
    """Converte o modelo ORM ChatMessage no DTO MessageResponse."""
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
        created_at=msg.created_at
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
    Retorna o histórico cronológico de mensagens trocadas entre a paciente e a Dra. Rosa.
    """
    thread = await get_or_create_active_thread(current_user.id, db)

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.thread_id == thread.id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()

    return ThreadDetailResponse(
        thread_id=str(thread.id),
        title=thread.title,
        current_emotional_state=thread.current_emotional_state,
        messages=[serialize_chat_message(m) for m in messages]
    )


@router.post(
    "/send",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Envio de mensagem à Dra. Rosa com NLU emocional, RAG e acolhimento"
)
async def send_message(
    payload: MessageSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Processa a mensagem da paciente com o motor cognitivo:
    1. Higieniza dados de PII (anonimização LGPD).
    2. Analisa estado emocional e gatilhos de sofrimento.
    3. Recupera contexto científico no pgvector (RAG).
    4. Gera resposta empática e segura com o Gemini 2.5 Flash.
    5. Injeta garantias institucionais do UNICEPLAC e INCA.
    """
    thread = await get_or_create_active_thread(current_user.id, db)

    # 1. Anonimização LGPD preventiva
    sanitized_user_message = anonymize_medical_text(payload.content)

    # 2. Análise Emocional NLU
    emotion = analyze_emotional_state(sanitized_user_message)
    thread.current_emotional_state = emotion["sentiment"]
    thread.last_message_at = datetime.now(timezone.utc)

    # 3. Recuperação de evidências médicas RAG via pgvector
    rag_contexts = await retrieve_relevant_medical_context(sanitized_user_message, db=db, top_k=2)
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
        rag_references=[]
    )
    db.add(user_msg_record)
    await db.flush()

    # 4. Geração com Gemini
    client = get_genai_client()
    assistant_reply = ""

    if client and settings.GEMINI_API_KEY:
        try:
            model = client.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=SYSTEM_PROMPT_DOUTORA_ROSA
            )
            combined_prompt = (
                f"{rag_text}\n"
                f"[SINALIZADOR EMOCIONAL: Apoio Psicológico Ativado={emotion['psychological_support_triggered']}, "
                f"Grau de Ansiedade={emotion['sentiment']}]\n\n"
                f"Pergunta da Paciente: {sanitized_user_message}"
            )
            response = await model.generate_content_async(combined_prompt)
            assistant_reply = response.text.strip()
        except Exception as exc:
            logger.error("Erro ao chamar Google GenAI API: %s", exc)

    if not assistant_reply:
        if emotion["psychological_support_triggered"]:
            assistant_reply = (
                "Olá, querida. Eu compreendo profundamente o quanto sentir uma alteração ou ter dúvidas sobre a saúde da mama "
                "pode trazer medo e insegurança. Quero que respire fundo e lembre-se de que estamos juntas nesta jornada.\n\n"
                "A ciência e os dados do INCA nos mostram com muita clareza que cerca de 80% das alterações que encontramos "
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

    # Garantia incondicional do aviso médico obrigatório (RNF13)
    if MANDATORY_MEDICAL_DISCLAIMER not in assistant_reply:
        assistant_reply = f"{assistant_reply}\n\n{MANDATORY_MEDICAL_DISCLAIMER}"

    # Salva resposta da Dra. Rosa no banco
    bot_msg_record = ChatMessage(
        thread_id=thread.id,
        sender_type="doutora_rosa",
        content=assistant_reply,
        detected_emotion=emotion["sentiment"],
        psychological_support_triggered=emotion["psychological_support_triggered"],
        rag_references=rag_titles
    )
    db.add(bot_msg_record)
    await db.commit()
    await db.refresh(bot_msg_record)

    return serialize_chat_message(bot_msg_record)
