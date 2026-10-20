import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class MessageSendRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000, description="Texto digitado pela usuária")
    attached_document_id: Optional[uuid.UUID] = Field(default=None, description="ID de laudo previamente anexado")


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


class ThreadDetailResponse(BaseModel):
    thread_id: str
    title: str
    current_emotional_state: str
    messages: List[MessageResponse]
