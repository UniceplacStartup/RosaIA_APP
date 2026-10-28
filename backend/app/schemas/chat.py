import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class MessageSendRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000, description="Texto digitado pela usuária")
    attached_document_id: Optional[uuid.UUID] = Field(default=None, description="ID de laudo previamente anexado")


class MessageFeedbackCreate(BaseModel):
    rating: int = Field(..., ge=-1, le=1, description="1 para útil/positivo (👍), -1 para negativo (👎)")
    comment: Optional[str] = Field(default=None, max_length=1000, description="Comentário ou sugestão de melhoria")
    allow_training_use: bool = Field(
        default=False,
        description="Autorização explícita (LGPD) para uso do par pergunta/resposta na melhoria e treino supervisionado da IA"
    )


class MessageFeedbackResponse(BaseModel):
    id: str
    message_id: str
    rating: int
    comment: Optional[str] = None
    allow_training_use: bool
    review_status: str
    created_at: datetime


class MessageResponse(BaseModel):
    id: str
    date_group: str
    time: str
    sender: str
    text: str
    emotion_tag: Optional[str] = None
    doc_attachment: Optional[str] = None
    psychological_support_triggered: bool = False
    rag_references: List[str] = []
    created_at: datetime
    # Telemetria & Qualidade
    ai_model: Optional[str] = None
    used_fallback: bool = False
    urgency_level: str = "none"
    user_rating: Optional[int] = None


class TriageExchangeRequest(BaseModel):
    user_text: str = Field(..., min_length=1, max_length=6000, description="Resumo da triagem enviado pela usuária")
    assistant_text: str = Field(..., min_length=1, max_length=12000, description="Resposta de acolhimento da Doutora Rosa")
    emotion_tag: Optional[str] = Field(default=None, max_length=100)


class TriageExchangeResponse(BaseModel):
    user_message: "MessageResponse"
    assistant_message: "MessageResponse"


class AudioChatResponse(BaseModel):
    transcript: str
    user_message: "MessageResponse"
    reply: "MessageResponse"


class ThreadDetailResponse(BaseModel):
    thread_id: str
    title: str
    current_emotional_state: str
    messages: List[MessageResponse]


class AIMetricsResponse(BaseModel):
    total_messages: int
    total_feedbacks: int
    positive_feedbacks: int
    negative_feedbacks: int
    satisfaction_rate: float
    fallback_rate: float
    avg_latency_ms: float
    active_kb_chunks: int
    curated_kb_chunks: int


class CurateFeedbackRequest(BaseModel):
    review_status: str = Field(..., description="approved, rejected, ou promoted")
    curated_answer: Optional[str] = Field(default=None, description="Resposta revisada por especialista clínico")
    reviewer_notes: Optional[str] = Field(default=None, description="Notas de auditoria clínica")
    promote_to_kb: bool = Field(default=False, description="Se True, indexa a resposta como novo fragmento da base RAG")
