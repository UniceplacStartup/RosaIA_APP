import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False, index=True
    )

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256_checksum: Mapped[str] = mapped_column(String(64), nullable=False)

    # Texto do laudo após anonimização de PII (sem CPF, RG, nomes de terceiros)
    extracted_text_anonymized: Mapped[str] = mapped_column(Text, nullable=False)
    document_category: Mapped[str] = mapped_column(String(50), nullable=False, default="laudo_mamografia")
    birads_mentioned: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    ai_educational_analysis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="documents")
    thread = relationship("ChatThread", back_populates="documents")
