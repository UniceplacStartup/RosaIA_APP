import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ChatThread(Base):
    __tablename__ = "chat_threads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False, default="Conversa com a Doutora Rosa")
    current_emotional_state: Mapped[str] = mapped_column(
        String(40), nullable=False, default="acolhimento_inicial"
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="threads")
    messages = relationship("ChatMessage", back_populates="thread", cascade="all, delete-orphan", order_by="ChatMessage.created_at")
    documents = relationship("UploadedDocument", back_populates="thread", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_type: Mapped[str] = mapped_column(String(20), nullable=False)  # user, doutora_rosa, system
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # RF07: Reconhecimento NLU de sentimento e acolhimento psicológico
    detected_emotion: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    psychological_support_triggered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    attached_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("uploaded_documents.id", ondelete="SET NULL"), nullable=True
    )
    rag_references: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    response_latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Telemetria da IA (melhoria contínua e monitoramento)
    ai_model: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    used_fallback: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    urgency_level: Mapped[str] = mapped_column(String(20), nullable=False, default="none", server_default="none")
    emotion_source: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )

    thread = relationship("ChatThread", back_populates="messages")
    attached_document = relationship("UploadedDocument")
