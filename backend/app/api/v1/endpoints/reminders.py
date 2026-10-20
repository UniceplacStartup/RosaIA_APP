import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.db.models.user import User
from app.schemas.reminder import (
    ReminderCreate,
    ReminderUpdate,
    ReminderResponse
)
from app.services.reminder_service import (
    list_user_reminders,
    create_user_reminder,
    update_user_reminder,
    delete_user_reminder
)

router = APIRouter(prefix="/reminders", tags=["Lembretes de Saúde Mamária (RF11)"])

@router.get(
    "",
    response_model=List[ReminderResponse],
    status_code=status.HTTP_200_OK,
    summary="Listagem de lembretes preventivos da paciente"
)
async def get_reminders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna todos os lembretes cadastrados para mamografia, ultrassonografia, consultas e medicações.
    """
    return await list_user_reminders(db=db, user=current_user)

@router.post(
    "",
    response_model=ReminderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criação de novo lembrete de saúde mamária"
)
async def create_reminder(
    payload: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cadastra um novo compromisso de saúde preventivo ou de tratamento.
    """
    return await create_user_reminder(db=db, user=current_user, data=payload)

@router.patch(
    "/{reminder_id}",
    response_model=ReminderResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualização de lembrete preventivo"
)
async def update_reminder(
    reminder_id: uuid.UUID,
    payload: ReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Atualiza título, data ou status de conclusão do lembrete.
    """
    return await update_user_reminder(db=db, user=current_user, reminder_id=reminder_id, data=payload)

@router.delete(
    "/{reminder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Exclusão de lembrete preventivo"
)
async def delete_reminder(
    reminder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove o registro do lembrete da base de dados.
    """
    await delete_user_reminder(db=db, user=current_user, reminder_id=reminder_id)
    return None
