import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    AccountLockedException,
    AuthenticationFailedException,
    RosaIABaseException,
)
from app.core.logging import log_security_event
from app.core.security import (
    clean_cpf_digits,
    compute_cpf_blind_index,
    create_access_token,
    encrypt_cpf,
    hash_ip,
    hash_password,
    mask_cpf,
    verify_password,
)
from app.db.models.chat import ChatMessage, ChatThread
from app.db.models.consent import UserConsent
from app.db.models.user import User
from app.schemas.auth import UserLoginRequest, UserRegisterRequest, TokenResponse


async def register_user(
    db: AsyncSession,
    payload: UserRegisterRequest,
    client_ip: str,
    user_agent: Optional[str]
) -> TokenResponse:
    """
    Registra uma nova usuária aplicando proteções LGPD e OWASP:
    - Blind Index do CPF (HMAC-SHA256)
    - Cifra simétrica do CPF (AES-256-GCM)
    - Hash Argon2id da senha
    - Registro de consentimento LGPD explícito
    - Criação da thread inicial com a Doutora Rosa
    """
    clean_cpf = clean_cpf_digits(payload.cpf)
    cpf_h = compute_cpf_blind_index(clean_cpf)
    ip_h = hash_ip(client_ip)

    # 1. Verifica duplicidade de e-mail
    stmt_email = select(User).where(User.email == payload.email.lower().strip())
    existing_email = (await db.execute(stmt_email)).scalar_one_or_none()
    if existing_email:
        raise RosaIABaseException(message="Já existe uma conta cadastrada com este e-mail.")

    # 2. Verifica duplicidade de CPF via Blind Index
    stmt_cpf = select(User).where(User.cpf_hash == cpf_h)
    existing_cpf = (await db.execute(stmt_cpf)).scalar_one_or_none()
    if existing_cpf:
        raise RosaIABaseException(message="Já existe uma conta cadastrada com este CPF.")

    # 3. Cria a usuária
    user = User(
        full_name=payload.full_name,
        email=payload.email.lower().strip(),
        cpf_hash=cpf_h,
        cpf_encrypted=encrypt_cpf(clean_cpf),
        cpf_masked=mask_cpf(clean_cpf),
        password_hash=hash_password(payload.password),
        role="patient",
    )
    db.add(user)
    await db.flush()

    # 4. Cria o consentimento LGPD auditável
    consent = UserConsent(
        user_id=user.id,
        terms_version="v1.0-2026",
        accepted_terms_of_use=payload.accepted_terms,
        accepted_medical_disclaimer=True,
        accepted_lgpd_health_data=True,
        ip_hash=ip_h,
        user_agent=user_agent,
    )
    db.add(consent)

    # 5. Cria a conversa inicial de acolhimento (conversa contínua estilo WhatsApp)
    thread = ChatThread(
        user_id=user.id,
        title="Conversa com a Doutora Rosa",
        current_emotional_state="acolhimento_inicial",
    )
    db.add(thread)
    await db.flush()

    # Mensagem inicial de boas-vindas da Doutora Rosa
    welcome_msg = ChatMessage(
        thread_id=thread.id,
        sender_type="doutora_rosa",
        content=(
            f"Olá, {user.full_name.split()[0]}! 🌸 Seja muito bem-vinda ao RosaIA APP. "
            "Eu sou a Doutora Rosa, sua assistente virtual de acolhimento e educação em saúde mamária. "
            "Nossa conversa fica salva aqui para você me chamar sempre que precisar. Como você está se sentindo hoje?"
        ),
        detected_emotion="acolhimento_inicial",
        psychological_support_triggered=False,
    )
    db.add(welcome_msg)

    await db.commit()
    await db.refresh(user)

    log_security_event("USER_REGISTERED_SUCCESS", ip_h, {"user_id": str(user.id), "email": user.email})

    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user={
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "cpf_masked": user.cpf_masked,
            "role": user.role,
        }
    )


async def authenticate_user(
    db: AsyncSession,
    payload: UserLoginRequest,
    client_ip: str,
    user_agent: Optional[str] = None
) -> TokenResponse:
    """
    Autenticação JWT com controle estrito de força bruta (OWASP A07):
    - Aceita e-mail ou CPF
    - Bloqueia após 5 tentativas consecutivas de senha incorreta por 15 minutos
    - Reseta contador em caso de sucesso
    """
    ip_h = hash_ip(client_ip)
    now = datetime.now(timezone.utc)
    identifier = payload.get_login_identifier()

    # Identifica se é CPF ou e-mail
    clean_id = clean_cpf_digits(identifier)
    if len(clean_id) == 11:
        cpf_h = compute_cpf_blind_index(clean_id)
        stmt = select(User).where(User.cpf_hash == cpf_h)
    else:
        stmt = select(User).where(User.email == identifier.lower().strip())

    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        log_security_event("LOGIN_FAILED_UNKNOWN_USER", ip_h, {"identifier_masked": identifier[:3] + "***"})
        raise AuthenticationFailedException()

    # Checa bloqueio temporário por força bruta
    if user.locked_until and user.locked_until > now:
        log_security_event("LOGIN_ATTEMPT_LOCKED_ACCOUNT", ip_h, {"user_id": str(user.id)})
        remaining = int((user.locked_until - now).total_seconds() / 60) + 1
        raise AccountLockedException(f"Esta conta está temporariamente bloqueada. Tente novamente em {remaining} minutos.")

    # Validação de senha
    if not verify_password(payload.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
            user.is_locked = True
            user.locked_until = now + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)
            log_security_event("ACCOUNT_LOCKED_BRUTE_FORCE", ip_h, {"user_id": str(user.id)})

        await db.commit()
        raise AuthenticationFailedException()

    # Sucesso: limpa tentativas e atualiza data de login
    user.failed_login_attempts = 0
    user.is_locked = False
    user.locked_until = None
    user.last_login_at = now
    await db.commit()
    await db.refresh(user)

    log_security_event("LOGIN_SUCCESS", ip_h, {"user_id": str(user.id)})
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user={
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "cpf_masked": user.cpf_masked,
            "role": user.role,
        }
    )
