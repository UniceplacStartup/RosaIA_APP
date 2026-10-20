from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.db.models.user import User
from app.schemas.triage import TriageInput, TriageResult
from app.services.triage_service import process_triage

router = APIRouter(prefix="/triage", tags=["Triagem Inteligente & Prevenção"])

@router.post(
    "/assess",
    response_model=TriageResult,
    status_code=status.HTTP_200_OK,
    summary="Avaliação de risco oncológico e rotinas de rastreamento do INCA (RF10)"
)
async def assess_triage(
    payload: TriageInput,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Realiza a triagem preventiva de sintomas com base nas diretrizes epidemiológicas
    do Ministério da Saúde e protocolos de acolhimento do UNICEPLAC:
    - Identifica sinais de alerta e histórico familiar de primeiro grau.
    - Estratifica em rotina preventiva, atenção moderada ou avaliação prioritária.
    - Injeta orientações claras para agendamento na rede de atenção básica (SUS).
    """
    return await process_triage(db=db, user=current_user, data=payload)
