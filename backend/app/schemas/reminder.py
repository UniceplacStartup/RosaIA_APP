import uuid
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

ReminderTypeLiteral = Literal["Exame", "Consulta", "Medicação", "Autocuidado"]


class ReminderCreate(BaseModel):
    reminder_type: ReminderTypeLiteral = Field(..., description="Tipo do lembrete")
    title: str = Field(..., min_length=2, max_length=150, description="Título do lembrete")
    notes: Optional[str] = Field(default=None, max_length=500)
    scheduled_for: datetime = Field(..., description="Data/hora agendada")


class ReminderUpdate(BaseModel):
    is_completed: Optional[bool] = None
    title: Optional[str] = Field(default=None, min_length=2, max_length=150)
    scheduled_for: Optional[datetime] = None


class ReminderResponse(BaseModel):
    id: str
    tipo: str
    titulo: str
    data: str
    concluido: bool
    notes: Optional[str] = None
