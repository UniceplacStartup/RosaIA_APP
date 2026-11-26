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
    generate_recovery_code,
    hash_ip,
    hash_password,
    hash_recovery_code,
    mask_cpf,
    verify_password,
    verify_recovery_code,
)
from app.db.models.chat import ChatMessage, ChatThread
from app.db.models.consent import UserConsent
from app.db.models.user import User
from app.schemas.auth import (
    GenerateRecoveryCodeResponse,
    PasswordResetWithCodeRequest,
    PasswordResetWithCodeResponse,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
)


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
        raise RosaIABaseException(
            status_code=409,
            detail="Já existe uma conta cadastrada com este e-mail."
        )

    # 2. Verifica duplicidade de CPF via Blind Index
    stmt_cpf = select(User).where(User.cpf_hash == cpf_h)
    existing_cpf = (await db.execute(stmt_cpf)).scalar_one_or_none()
    if existing_cpf:
        raise RosaIABaseException(
            status_code=409,
            detail="Já existe uma conta cadastrada com este CPF."
        )

    # 3. Cria a usuária e gera o código de recuperação de uso único (salvo apenas como hash)
    recovery_code = generate_recovery_code()
    now = datetime.now(timezone.utc)
    user = User(
        full_name=payload.full_name,
        email=payload.email.lower().strip(),
        cpf_hash=cpf_h,
        cpf_encrypted=encrypt_cpf(clean_cpf),
        cpf_masked=mask_cpf(clean_cpf),
        password_hash=hash_password(payload.password),
        recovery_code_hash=hash_recovery_code(recovery_code),
        recovery_code_generated_at=now,
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
        recovery_code=recovery_code,
        user={
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "cpf_masked": user.cpf_masked,
            "role": user.role,
            "has_recovery_code": True,
            "needs_recovery_code": False,
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
            user.locked_until = now + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)
            log_security_event("ACCOUNT_LOCKED_BRUTE_FORCE", ip_h, {"user_id": str(user.id)})

        await db.commit()
        raise AuthenticationFailedException()

    # Sucesso: limpa tentativas e atualiza data de login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    await db.commit()
    await db.refresh(user)

    log_security_event("LOGIN_SUCCESS", ip_h, {"user_id": str(user.id)})
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})

    has_recovery = bool(user.recovery_code_hash)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user={
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "cpf_masked": user.cpf_masked,
            "role": user.role,
            "has_recovery_code": has_recovery,
            "needs_recovery_code": not has_recovery,
        }
    )


async def generate_or_rotate_recovery_code(
    db: AsyncSession,
    user: User,
    current_password: Optional[str],
    client_ip: str,
) -> GenerateRecoveryCodeResponse:
    """
    Gera um novo código de recuperação para a usuária autenticada.
    - Para contas antigas sem código cadastrado (recovery_code_hash is None), permite geração imediata no login.
    - Para contas que já possuem código, exige a senha atual para evitar troca indevida.
    """
    ip_h = hash_ip(client_ip)
    already_has_code = bool(user.recovery_code_hash)

    if already_has_code:
        if not current_password or not verify_password(current_password, user.password_hash):
            log_security_event("RECOVERY_CODE_ROTATE_BAD_PASSWORD", ip_h, {"user_id": str(user.id)})
            raise RosaIABaseException(
                status_code=401,
                detail="Senha atual incorreta. Informe sua senha atual para gerar um novo código de recuperação."
            )

    new_code = generate_recovery_code()
    user.recovery_code_hash = hash_recovery_code(new_code)
    user.recovery_code_generated_at = datetime.now(timezone.utc)
    await db.commit()

    event_name = "RECOVERY_CODE_ROTATED" if already_has_code else "RECOVERY_CODE_INITIALIZED"
    log_security_event(event_name, ip_h, {"user_id": str(user.id)})

    return GenerateRecoveryCodeResponse(
        recovery_code=new_code,
        message=(
            "Novo código de recuperação gerado! O código anterior foi invalidado. "
            "Guarde este código em um local seguro, pois ele será exibido apenas uma vez."
            if already_has_code
            else "Código de recuperação ativado com sucesso! Guarde-o em um local seguro, pois ele será exibido apenas uma vez."
        ),
    )


async def reset_password_with_recovery_code(
    db: AsyncSession,
    payload: PasswordResetWithCodeRequest,
    client_ip: str,
) -> PasswordResetWithCodeResponse:
    """
    Redefine a senha usando apenas código próprio (zero serviços externos):
    - Valida e-mail ou CPF + código de recuperação (hash Argon2id)
    - Aplica proteção contra força bruta (OWASP A07)
    - Consome o código usado e gera um novo código de recuperação imediatamente (uso único)
    """
    ip_h = hash_ip(client_ip)
    now = datetime.now(timezone.utc)
    identifier = payload.identifier.strip()

    if payload.confirm_password is not None and payload.new_password != payload.confirm_password:
        raise RosaIABaseException(
            status_code=422,
            detail="A nova senha e a confirmação não conferem."
        )

    generic_error = (
        "E-mail/CPF ou código de recuperação inválido. "
        "Caso sua conta seja antiga e você nunca tenha gerado um código, entre em contato com o suporte."
    )

    clean_id = clean_cpf_digits(identifier)
    if len(clean_id) == 11:
        cpf_h = compute_cpf_blind_index(clean_id)
        stmt = select(User).where(User.cpf_hash == cpf_h)
    else:
        stmt = select(User).where(User.email == identifier.lower())

    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not user.is_active:
        log_security_event("PASSWORD_RESET_UNKNOWN_USER", ip_h, {"identifier_masked": identifier[:3] + "***"})
        raise RosaIABaseException(status_code=400, detail=generic_error)

    if user.locked_until and user.locked_until > now:
        log_security_event("PASSWORD_RESET_LOCKED_ACCOUNT", ip_h, {"user_id": str(user.id)})
        remaining = int((user.locked_until - now).total_seconds() / 60) + 1
        raise AccountLockedException(
            f"Esta conta está temporariamente bloqueada por segurança. Tente novamente em {remaining} minutos."
        )

    if not user.recovery_code_hash or not verify_recovery_code(payload.recovery_code, user.recovery_code_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)
            log_security_event("ACCOUNT_LOCKED_RESET_BRUTE_FORCE", ip_h, {"user_id": str(user.id)})
        else:
            log_security_event("PASSWORD_RESET_INVALID_CODE", ip_h, {"user_id": str(user.id)})
        await db.commit()
        raise RosaIABaseException(status_code=400, detail=generic_error)

    # Código válido: atualiza senha e rotaciona o código de recuperação (uso único)
    new_recovery_code = generate_recovery_code()
    user.password_hash = hash_password(payload.new_password)
    user.recovery_code_hash = hash_recovery_code(new_recovery_code)
    user.recovery_code_generated_at = now
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    log_security_event("PASSWORD_RESET_SUCCESS", ip_h, {"user_id": str(user.id)})

    return PasswordResetWithCodeResponse(
        message="Senha redefinida com sucesso! O código utilizado foi invalidado. Salve seu novo código de recuperação.",
        new_recovery_code=new_recovery_code,
    )


async def check_cpf_exists(db: AsyncSession, cpf: str) -> bool:
    """Verifica de forma segura (Blind Index LGPD) se o CPF já está cadastrado."""
    clean_cpf = clean_cpf_digits(cpf)
    if len(clean_cpf) != 11:
        return False
    cpf_h = compute_cpf_blind_index(clean_cpf)
    stmt = select(User.id).where(User.cpf_hash == cpf_h)
    existing = (await db.execute(stmt)).first()
    return existing is not None


async def check_email_exists(db: AsyncSession, email: str) -> bool:
    """Verifica se o e-mail já está cadastrado na base."""
    clean_email = email.lower().strip()
    if not clean_email or "@" not in clean_email:
        return False
    stmt = select(User.id).where(User.email == clean_email)
    existing = (await db.execute(stmt)).first()
    return existing is not None

