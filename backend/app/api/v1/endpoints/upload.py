import hashlib
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.v1.endpoints.chat import get_or_create_active_thread
from app.db.models.user import User
from app.db.models.document import UploadedDocument
from app.schemas.document import DocumentAnalysisResponse
from app.services.file_validator import (
    validate_medical_document_file,
    extract_text_from_file_bytes
)
from app.services.lgpd_service import anonymize_medical_text
from app.ai.report_interpreter import generate_educational_report_analysis
from app.ai.prompts import MANDATORY_MEDICAL_DISCLAIMER

router = APIRouter(prefix="/upload", tags=["Laudos Médicos & LGPD"])

@router.post(
    "/document",
    response_model=DocumentAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload e análise educativa de laudos em PDF/DOCX/TXT com bloqueio de fotos (HTTP 415)"
)
async def upload_medical_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Recebe um laudo médico e processa com salvaguardas máximas de segurança:
    - Bloqueia expressamente qualquer imagem, foto médica ou arquivo DICOM (HTTP 415).
    - Valida Magic Bytes para impedir spoofing de extensão de arquivo.
    - Sanitiza dados identificadores (PII Scrubbing: CPF, RG, nomes, contatos).
    - Identifica classificação BI-RADS e traduz termos técnicos para linguagem leiga e acolhedora.
    - Injeta aviso incondicional de que a ferramenta não emite diagnóstico clínico.
    """
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="O arquivo excede o tamanho máximo permitido de 5 MB."
        )

    # 1. Validação estrita de extensão e Magic Bytes (lança HTTP 415 se for imagem)
    validated_info = validate_medical_document_file(
        file_bytes=content,
        filename=file.filename or "laudo.pdf",
        declared_content_type=file.content_type
    )

    # 2. Extração de texto do documento limpo
    raw_text = extract_text_from_file_bytes(
        file_bytes=content,
        extension=validated_info["extension"]
    )

    if not raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Não foi possível extrair conteúdo textual legível do arquivo fornecido."
        )

    # 3. Sanitização mandatória de dados pessoais (LGPD PII Scrubbing)
    sanitized_text = anonymize_medical_text(raw_text)

    # 4. Análise do laudo com BI-RADS e persona acolhedora da Dra. Rosa
    analysis = await generate_educational_report_analysis(
        sanitized_text=sanitized_text,
        original_filename=validated_info["filename"]
    )

    # 5. Recupera a conversa ativa para vínculo
    thread = await get_or_create_active_thread(current_user.id, db)
    checksum = hashlib.sha256(content).hexdigest()
    birads_val = analysis.get("birads_category")
    birads_str = f"BI-RADS {birads_val}" if birads_val is not None else None

    # 6. Persistência do laudo higienizado
    doc_record = UploadedDocument(
        user_id=current_user.id,
        thread_id=thread.id,
        original_filename=validated_info["filename"],
        file_size_bytes=len(content),
        mime_type=validated_info["detected_mime"],
        sha256_checksum=checksum,
        extracted_text_anonymized=sanitized_text,
        document_category="laudo_mamografia",
        birads_mentioned=birads_str,
        ai_educational_analysis=analysis.get("educational_summary")
    )
    db.add(doc_record)
    await db.commit()
    await db.refresh(doc_record)

    preview = (sanitized_text[:250] + "...") if len(sanitized_text) > 250 else sanitized_text

    return DocumentAnalysisResponse(
        document_id=str(doc_record.id),
        filename=doc_record.original_filename,
        lgpd_anonymized=True,
        extracted_preview=preview,
        birads_detected=birads_str,
        educational_interpretation=analysis.get("educational_summary", ""),
        medical_disclaimer=MANDATORY_MEDICAL_DISCLAIMER
    )
