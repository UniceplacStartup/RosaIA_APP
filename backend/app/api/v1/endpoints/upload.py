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
from app.ai.prompts import MANDATORY_MEDICAL_DISCLAIMER, clean_rosa_text

router = APIRouter(prefix="/upload", tags=["Laudos Médicos & LGPD"])

@router.post(
    "/document",
    response_model=DocumentAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload e análise educativa de laudos e imagens médicas (DICOM e convencionais)"
)
async def upload_medical_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Recebe laudo ou exame de imagem (PDF, TXT, DOCX, DICOM, JPG, PNG, WEBP, TIFF):
    - Aceita imagens DICOM e convencionais com validação estrita.
    - Sanitiza dados identificadores (PII Scrubbing: CPF, RG, nomes, contatos) e metadados.
    - Retorna exclusivamente informações descritivas do laudo, sem dados pessoais.
    - Permite tirar dúvidas sobre o laudo de forma interativa.
    - Sem asteriscos (*) ou hashtags (#).
    """
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="O arquivo excede o tamanho máximo permitido de 15 MB."
        )

    # 1. Validação estrita de extensão e Magic Bytes
    validated_info = validate_medical_document_file(
        file_bytes=content,
        filename=file.filename or "exame.pdf",
        declared_content_type=file.content_type
    )

    # 2. Extração de texto/descrição do arquivo
    raw_text = extract_text_from_file_bytes(
        file_bytes=content,
        extension=validated_info["extension"],
        filename=validated_info["filename"]
    )

    if not raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Não foi possível extrair conteúdo descritivo legível do arquivo fornecido."
        )

    # 3. Sanitização mandatória de dados pessoais (LGPD PII Scrubbing)
    sanitized_text = anonymize_medical_text(raw_text)

    # 4. Análise do laudo com BI-RADS e persona acolhedora da Dra. Rosa (sem asteriscos/hashtags)
    analysis = await generate_educational_report_analysis(
        sanitized_text=sanitized_text,
        original_filename=validated_info["filename"]
    )

    # 5. Recupera a conversa ativa para vínculo
    thread = await get_or_create_active_thread(current_user.id, db)
    checksum = hashlib.sha256(content).hexdigest()
    birads_val = analysis.get("birads_category")
    birads_str = f"BI-RADS {birads_val}" if birads_val is not None else None

    # Mapeamento de categoria compatível com o schema do banco
    category = "laudo_mamografia"
    if validated_info["file_kind"] == "dicom":
        category = "laudo_mamografia"
    elif "ultrassom" in (file.filename or "").lower():
        category = "laudo_ultrassonografia"

    # 6. Persistência do laudo higienizado
    doc_record = UploadedDocument(
        user_id=current_user.id,
        thread_id=thread.id,
        original_filename=validated_info["filename"],
        file_size_bytes=len(content),
        mime_type=validated_info["detected_mime"],
        sha256_checksum=checksum,
        extracted_text_anonymized=sanitized_text,
        document_category=category,
        birads_mentioned=birads_str,
        ai_educational_analysis=clean_rosa_text(analysis.get("educational_summary", ""))
    )
    db.add(doc_record)
    await db.commit()
    await db.refresh(doc_record)

    preview = (sanitized_text[:250] + "...") if len(sanitized_text) > 250 else sanitized_text

    return DocumentAnalysisResponse(
        document_id=str(doc_record.id),
        filename=doc_record.original_filename,
        lgpd_anonymized=True,
        extracted_preview=clean_rosa_text(preview),
        birads_detected=birads_str,
        educational_interpretation=clean_rosa_text(analysis.get("educational_summary", "")),
        medical_disclaimer=clean_rosa_text(MANDATORY_MEDICAL_DISCLAIMER)
    )
