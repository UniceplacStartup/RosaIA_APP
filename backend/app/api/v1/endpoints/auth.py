from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    PasswordResetRequest,
    PasswordResetResponse
)
from app.services.auth_service import (
    register_user,
    authenticate_user,
    check_cpf_exists,
    check_email_exists,
)
from app.core.logging import log_security_event
from app.core.security import hash_ip

router = APIRouter(prefix="/auth", tags=["Autenticação & LGPD"])

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastro de usuária com CPF Blind Index e consentimento LGPD"
)
async def register(
    request: Request,
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Registra uma nova usuária no sistema aplicando:
    - Validação matemática de CPF via algoritmo Módulo 11.
    - Geração de Blind Index HMAC-SHA256 (`cpf_hash`).
    - Criptografia reversível AES-256-GCM dos dígitos do CPF.
    - Gravação do aceite inequívoco da Política de Privacidade e Termos LGPD v1.0.
    """
    client_ip = request.client.host if request.client else "0.0.0.0"
    user_agent = request.headers.get("user-agent", "Unknown")

    return await register_user(
        db=db,
        payload=payload,
        client_ip=client_ip,
        user_agent=user_agent
    )

@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login por e-mail ou CPF com proteção contra ataques de força bruta (OWASP A07)"
)
async def login(
    request: Request,
    payload: UserLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Autentica a usuária por CPF ou e-mail.
    Bloqueia temporariamente a conta caso ocorram 5 tentativas incorretas consecutivas.
    """
    client_ip = request.client.host if request.client else "0.0.0.0"
    user_agent = request.headers.get("user-agent", "Unknown")

    return await authenticate_user(
        db=db,
        payload=payload,
        client_ip=client_ip,
        user_agent=user_agent
    )

@router.post(
    "/recover",
    response_model=PasswordResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Recuperação de senha segura com proteção contra enumeração"
)
async def recover_password(
    request: Request,
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Inicia o fluxo seguro de redefinição de credenciais.
    Retorna sempre mensagem genérica para mitigar enumeração de contas (OWASP A07).
    """
    client_ip = request.client.host if request.client else "0.0.0.0"
    identifier = payload.get_identifier()
    log_security_event(
        event_type="AUTH_RECOVER_REQUEST",
        ip_hash=hash_ip(client_ip),
        details={"identifier_hint": identifier[:3] + "***"}
    )
    return PasswordResetResponse(
        message="Se os dados informados constarem em nossa base, as instruções de recuperação serão encaminhadas com segurança."
    )


@router.get(
    "/check-cpf",
    summary="Verifica se o CPF já está cadastrado (Blind Index LGPD)",
    status_code=status.HTTP_200_OK
)
async def check_cpf(
    cpf: str,
    db: AsyncSession = Depends(get_db)
):
    exists = await check_cpf_exists(db, cpf)
    return {
        "exists": exists,
        "message": "Este CPF já possui cadastro no RosaIA." if exists else "CPF disponível para cadastro."
    }


@router.get(
    "/check-email",
    summary="Verifica se o e-mail já está cadastrado",
    status_code=status.HTTP_200_OK
)
async def check_email(
    email: str,
    db: AsyncSession = Depends(get_db)
):
    exists = await check_email_exists(db, email)
    return {
        "exists": exists,
        "message": "Este e-mail já possui cadastro no RosaIA." if exists else "E-mail disponível para cadastro."
    }

