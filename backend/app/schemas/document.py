import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.schemas.chat import MessageResponse


class DocumentUploadMetadata(BaseModel):
    id: uuid.UUID
    original_filename: str
    mime_type: str
    file_size_bytes: int
    created_at: datetime


class DocumentAnalysisResponse(BaseModel):
    document_id: str
    filename: str
    lgpd_anonymized: bool = True
    extracted_preview: str
    birads_detected: Optional[str] = None
    educational_interpretation: str
    image_kind: Optional[str] = None
    user_message: Optional[MessageResponse] = None
    assistant_message: Optional[MessageResponse] = None
    medical_disclaimer: str = "Aviso Médico (RNF13): Esta análise é puramente educativa e não substitui consulta com mastologista ou médico especialista."
