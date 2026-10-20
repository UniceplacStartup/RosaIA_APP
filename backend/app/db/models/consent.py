import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserConsent(Base):
    __tablename__ = "user_consents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    terms_version: Mapped[str] = mapped_column(String(20), nullable=False, default="v1.0-2026")
    accepted_terms_of_use: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    accepted_medical_disclaimer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    accepted_lgpd_health_data: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    ip_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    consented_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="consents")
