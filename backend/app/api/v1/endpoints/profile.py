from fastapi import APIRouter, Depends, Request, status, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.db.models.user import User
from app.db.models.consent import UserConsent
from app.schemas.user import (
    UserProfileResponse,
    UserDataExportResponse,
    AccountDeleteRequest
)
from app.services.lgpd_service import (
    export_user_data_lgpd,
    delete_user_account_permanently
)
from app.core.security import mask_cpf, decrypt_cpf

router = APIRouter(prefix="/profile", tags=["Perfil & Direitos LGPD (Art. 18)"])

@router.get(
    "",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Consulta de perfil do usuário com CPF mascarado"
)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna os dados cadastrais da usuária autenticada.
    O CPF é exibido estritamente na forma mascarada (***.456.789-**).
    """
    stmt = (
        select(UserConsent)
        .where(UserConsent.user_id == current_user.id)
        .order_by(UserConsent.consented_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    consent = result.scalar_one_or_none()

    plain_cpf = decrypt_cpf(current_user.cpf_encrypted)
    masked = mask_cpf(plain_cpf)

    terms_dt_str = consent.consented_at.isoformat() if consent and consent.consented_at else None

    return UserProfileResponse(
        id=str(current_user.id),
        full_name=current_user.full_name,
        email=current_user.email,
        cpf_masked=masked,
        role=current_user.role,
        is_active=current_user.is_active,
        terms_accepted_at=terms_dt_str
    )

@router.post(
    "/export",
    response_model=UserDataExportResponse,
    status_code=status.HTTP_200_OK,
    summary="Portabilidade de dados cadastrais e médicos (LGPD Art. 18, V)"
)
async def export_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Gera um relatório completo e estruturado de todos os dados pessoais,
    laudos higienizados, triagens e histórico de acolhimento sob a titularidade da paciente.
    """
    return await export_user_data_lgpd(db=db, user=current_user)

@router.delete(
    "/delete",
    status_code=status.HTTP_200_OK,
    summary="Direito ao esquecimento / Exclusão permanente (LGPD Art. 18, VI)"
)
async def delete_account(
    request: Request,
    payload: AccountDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Executa o expurgo definitivo de todos os dados da conta da paciente.
    Exige a palavra 'EXCLUIR' como confirmação consciente.
    """
    client_ip = request.client.host if request.client else "0.0.0.0"

    await delete_user_account_permanently(
        db=db,
        user=current_user,
        confirmation_word=payload.get_confirmation(),
        client_ip=client_ip
    )

    return {
        "status": "success",
        "message": "Sua conta e todos os dados associados foram permanentemente eliminados da base de dados com conformidade LGPD."
    }
