import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, LargeBinary, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # LGPD & OWASP A02: CPF nunca em texto puro
    cpf_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    cpf_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    cpf_masked: Mapped[str] = mapped_column(String(14), nullable=False, default="***.***.***-**")

    # Hash de senha com Argon2id
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="patient")

    # OWASP A07: Proteção contra força bruta
    failed_login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    notification_preferences: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=lambda: {"push": True, "email": True, "reminders": True}
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # LGPD Art. 18: Flag de conta ativa ou anonimizada
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relacionamentos
    consents = relationship("UserConsent", back_populates="user", cascade="all, delete-orphan")
    threads = relationship("ChatThread", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("UploadedDocument", back_populates="user", cascade="all, delete-orphan")
    triage_assessments = relationship("TriageAssessment", back_populates="user", cascade="all, delete-orphan")
    reminders = relationship("HealthReminder", back_populates="user", cascade="all, delete-orphan")
