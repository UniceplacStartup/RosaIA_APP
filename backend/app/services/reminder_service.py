import uuid
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import RosaIABaseException
from app.db.models.reminder import HealthReminder
from app.db.models.user import User
from app.schemas.reminder import ReminderCreate, ReminderResponse, ReminderUpdate


async def list_user_reminders(db: AsyncSession, user: User) -> List[ReminderResponse]:
    """Lista todos os lembretes da usuária ordenados por data."""
    stmt = (
        select(HealthReminder)
        .where(HealthReminder.user_id == user.id)
        .order_by(HealthReminder.scheduled_for.asc())
    )
    result = await db.execute(stmt)
    reminders = result.scalars().all()
    return [
        ReminderResponse(
            id=str(r.id),
            tipo=r.reminder_type,
            titulo=r.title,
            data=r.scheduled_for.strftime("%Y-%m-%d"),
            concluido=r.is_completed,
            notes=r.notes,
        )
        for r in reminders
    ]


async def create_user_reminder(db: AsyncSession, user: User, data: ReminderCreate) -> ReminderResponse:
    """Cria um novo lembrete preventivo (exame, consulta, medicação, autocuidado)."""
    reminder = HealthReminder(
        user_id=user.id,
        reminder_type=data.reminder_type,
        title=data.title.strip(),
        notes=data.notes,
        scheduled_for=data.scheduled_for,
        is_completed=False,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return ReminderResponse(
        id=str(reminder.id),
        tipo=reminder.reminder_type,
        titulo=reminder.title,
        data=reminder.scheduled_for.strftime("%Y-%m-%d"),
        concluido=reminder.is_completed,
        notes=reminder.notes,
    )


async def update_user_reminder(
    db: AsyncSession, user: User, reminder_id: uuid.UUID, data: ReminderUpdate
) -> ReminderResponse:
    """Atualiza o status (toggle concluído) ou data/título do lembrete."""
    stmt = select(HealthReminder).where(
        HealthReminder.id == reminder_id, HealthReminder.user_id == user.id
    )
    reminder = (await db.execute(stmt)).scalar_one_or_none()
    if not reminder:
        raise RosaIABaseException(status_code=404, detail="Lembrete não encontrado.")

    if data.is_completed is not None:
        reminder.is_completed = data.is_completed
    if data.title is not None:
        reminder.title = data.title.strip()
    if data.scheduled_for is not None:
        reminder.scheduled_for = data.scheduled_for

    await db.commit()
    await db.refresh(reminder)
    return ReminderResponse(
        id=str(reminder.id),
        tipo=reminder.reminder_type,
        titulo=reminder.title,
        data=reminder.scheduled_for.strftime("%Y-%m-%d"),
        concluido=reminder.is_completed,
        notes=reminder.notes,
    )


async def delete_user_reminder(db: AsyncSession, user: User, reminder_id: uuid.UUID) -> None:
    """Exclui um lembrete da usuária."""
    stmt = delete(HealthReminder).where(
        HealthReminder.id == reminder_id, HealthReminder.user_id == user.id
    )
    result = await db.execute(stmt)
    if result.rowcount == 0:
        raise RosaIABaseException(status_code=404, detail="Lembrete não encontrado.")
    await db.commit()
