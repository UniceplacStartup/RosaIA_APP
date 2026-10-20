import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TriageAssessment(Base):
    __tablename__ = "triage_assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    age_range: Mapped[str] = mapped_column(String(30), nullable=False)
    has_family_history: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reported_signs: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    emotional_impact_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    attention_level: Mapped[str] = mapped_column(String(25), nullable=False)
    ai_guidance_summary: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="triage_assessments")
