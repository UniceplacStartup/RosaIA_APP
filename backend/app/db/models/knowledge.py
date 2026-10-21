import uuid
from datetime import datetime, timezone
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class KnowledgeBaseChunk(Base):
    __tablename__ = "knowledge_base_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    source_institution: Mapped[str] = mapped_column(String(100), nullable=False)
    reference_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    topic_category: Mapped[str] = mapped_column(String(50), nullable=False)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Vetor de 768 dimensões gerado por text-embedding-004 do Google Gemini
    embedding = mapped_column(Vector(768), nullable=True)

    # official = fontes científicas ingeridas dos arquivos; curated = correções aprovadas por profissionais
    origin: Mapped[str] = mapped_column(String(20), nullable=False, default="official", server_default="official", index=True)
    # SHA-256 de título+conteúdo: torna a ingestão idempotente
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
