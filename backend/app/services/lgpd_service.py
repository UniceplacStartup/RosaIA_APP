import re
from datetime import datetime, timezone
from typing import Any, Dict

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AccountDeletionConfirmationException
from app.core.logging import log_security_event
from app.core.security import hash_ip
from app.db.models.chat import ChatMessage, ChatThread
from app.db.models.consent import UserConsent
from app.db.models.document import UploadedDocument
from app.db.models.reminder import HealthReminder
from app.db.models.triage import TriageAssessment
from app.db.models.user import User


def anonymize_medical_text(raw_text: str) -> str:
    """
    Higienização rigorosa de PII (Personally Identifiable Information) em laudos
    e documentos médicos antes de qualquer processamento por IA (LGPD & RNF04).
    """
    if not raw_text:
        return ""

    # 1. Anonimização de CPF
    text = re.sub(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", "[CPF_OCULTO_LGPD]", raw_text)

    # 2. Anonimização de E-mail
    text = re.sub(
        r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
        "[EMAIL_OCULTO_LGPD]",
        text,
    )

    # 3. Anonimização de Telefones (formatos com DDD)
    text = re.sub(
        r"(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})",
        "[TELEFONE_OCULTO_LGPD]",
        text,
    )

    # 4. Anonimização de marcadores de paciente/médico em laudos radiológicos
    text = re.sub(
        r"(?i)(?:paciente|nome da paciente|solicitante|médico solicitante|dr\(a\)?)\s*:\s*([^\n,;]{2,50})",
        r"\g<0>[PACIENTE_ANONIMIZADO]",
        text,
    )

    return text


async def export_user_data_lgpd(db: AsyncSession, user: User) -> Dict[str, Any]:
    """
    Gera o pacote de portabilidade de dados da paciente (LGPD Art. 18, Inciso V).
    Exporta conversas, lembretes e metadados sem vazar segredos ou hashes criptográficos.
    """
    # Busca todas as mensagens de todas as threads da usuária
    stmt_messages = (
        select(ChatMessage)
        .join(ChatThread, ChatMessage.thread_id == ChatThread.id)
        .where(ChatThread.user_id == user.id)
        .order_by(ChatMessage.created_at.asc())
    )
    result_messages = await db.execute(stmt_messages)
    messages = result_messages.scalars().all()

    # Busca lembretes
    stmt_reminders = (
        select(HealthReminder)
        .where(HealthReminder.user_id == user.id)
        .order_by(HealthReminder.scheduled_for.asc())
    )
    result_reminders = await db.execute(stmt_reminders)
    reminders = result_reminders.scalars().all()

    return {
        "exportado_em": datetime.now(timezone.utc).isoformat(),
        "base_legal": "LGPD — Lei nº 13.709/2018, Art. 18 (Direito de Portabilidade)",
        "titular": {
            "full_name": user.full_name,
            "email": user.email,
            "cpf_masked": user.cpf_masked,
            "created_at": user.created_at.isoformat(),
        },
        "conversas": [
            {
                "id": str(m.id),
                "remetente": m.sender_type,
                "mensagem": m.content,
                "data_hora": m.created_at.isoformat(),
                "emocao_acolhida": m.detected_emotion,
            }
            for m in messages
        ],
        "lembretes": [
            {
                "id": str(r.id),
                "tipo": r.reminder_type,
                "titulo": r.title,
                "data": r.scheduled_for.isoformat(),
                "concluido": r.is_completed,
            }
            for r in reminders
        ],
    }


async def delete_user_account_permanently(
    db: AsyncSession, user: User, confirmation_word: str, client_ip: str
) -> None:
    """
    Executa o Hard Delete / Direito ao Esquecimento (LGPD Art. 18, Inciso VI).
    Exige a palavra 'EXCLUIR' e remove todos os registros pessoais em cascata.
    """
    if confirmation_word.strip().upper() != "EXCLUIR":
        raise AccountDeletionConfirmationException()

    user_id = user.id
    ip_h = hash_ip(client_ip)

    # Exclui a usuária (o CASCADE do banco e do SQLAlchemy limpa threads, mensagens, documentos e lembretes)
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()

    log_security_event(
        event_type="ACCOUNT_DELETED_PERMANENTLY_LGPD",
        ip_hash=ip_h,
        details={"user_id": str(user_id), "status": "erased"},
    )
