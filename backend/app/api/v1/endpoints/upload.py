import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompts import MANDATORY_MEDICAL_DISCLAIMER, clean_rosa_text
from app.ai.report_interpreter import analyze_medical_image, generate_educational_report_analysis
from app.api.deps import get_db, get_optional_current_user
from app.api.v1.endpoints.chat import (
    format_date_group,
    get_or_create_active_thread,
    serialize_chat_message,
)
from app.db.models.chat import ChatMessage
from app.db.models.document import UploadedDocument
from app.db.models.user import User
from app.schemas.chat import MessageResponse
from app.schemas.document import DocumentAnalysisResponse
from app.services.file_validator import (
    extract_image_technical_context,
    extract_text_from_file_bytes,
    prepare_image_for_vision,
    validate_medical_document_file,
)
from app.services.lgpd_service import anonymize_medical_text

logger = logging.getLogger("rosaia.upload")
router = APIRouter(prefix="/upload", tags=["Laudos Médicos & LGPD"])


@router.post(
    "/document",
    response_model=DocumentAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload e análise individual, objetiva e específica de imagens médicas (DICOM e convencionais) e laudos",
)
async def upload_medical_document(
    file: UploadFile = File(...),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Recebe laudo ou exame de imagem (PDF, TXT, DOCX, DICOM, JPG, PNG, WEBP, TIFF):
    - Avalia individualmente cada imagem (DICOM ou convencional) com visão multimodal e metadados técnicos.
    - Sanitiza dados identificadores (PII Scrubbing: CPF, RG, nomes, contatos) e metadados.
    - Retorna análise objetiva e específica para a imagem ou documento enviado, sem respostas genéricas.
    - Sem asteriscos (*) ou hashtags (#).
    """
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="O arquivo excede o tamanho máximo permitido de 15 MB.",
        )

    # 1. Validação de extensão e Magic Bytes
    validated_info = validate_medical_document_file(
        file_bytes=content,
        filename=file.filename or "exame.dcm",
        declared_content_type=file.content_type,
    )

    # 2. Extração de texto/descrição base do arquivo
    raw_text = extract_text_from_file_bytes(
        file_bytes=content,
        extension=validated_info["extension"],
        filename=validated_info["filename"],
    )

    if not raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Não foi possível extrair conteúdo descritivo legível do arquivo fornecido.",
        )

    # 3. Sanitização mandatória de dados pessoais (LGPD PII Scrubbing)
    sanitized_text = anonymize_medical_text(raw_text)

    # 4. Análise: imagens (DICOM/convencionais) recebem análise visual e técnica individualizada
    is_image_upload = validated_info["file_kind"] in ("image", "dicom")
    image_kind: Optional[str] = None
    is_breast = True
    birads_val = None
    reply_text = ""

    if is_image_upload:
        vision_image = prepare_image_for_vision(content, validated_info["filename"])
        tech_context, tech_meta = extract_image_technical_context(
            content,
            validated_info["filename"],
            vision_image[0] if vision_image else None,
        )
        sanitized_text = anonymize_medical_text(tech_context)
        image_analysis = await analyze_medical_image(
            vision_image,
            validated_info["filename"],
            extra_context=sanitized_text,
            technical_meta=tech_meta,
        )
        image_kind = image_analysis.image_kind
        is_breast = image_analysis.is_breast_imaging
        birads_val = image_analysis.visible_birads
        reply_text = image_analysis.reply
    else:
        analysis = await generate_educational_report_analysis(
            sanitized_text=sanitized_text,
            original_filename=validated_info["filename"],
        )
        birads_val = analysis.get("birads_category")
        reply_text = clean_rosa_text(analysis.get("educational_summary", ""))

    birads_str = f"BI-RADS {birads_val}" if birads_val is not None else None

    clean_disclaimer = clean_rosa_text(MANDATORY_MEDICAL_DISCLAIMER)
    if clean_disclaimer not in reply_text:
        reply_text = f"{reply_text}\n\n{clean_disclaimer}"

    now = datetime.now(timezone.utc)
    doc_id_str = str(uuid.uuid4())
    user_msg_dto: Optional[MessageResponse] = None
    bot_msg_dto: Optional[MessageResponse] = None

    # 5. Persistência no banco caso a pessoa esteja autenticada
    if current_user is not None:
        try:
            thread = await get_or_create_active_thread(current_user.id, db)
            checksum = hashlib.sha256(content).hexdigest()

            # Categorias compatíveis com qualquer versão do banco (incluindo constraints legadas)
            category = "laudo_mamografia"
            if not is_breast:
                category = "outro_documento"
            elif "ultrassom" in (file.filename or "").lower() or (image_kind or "") == "ultrassom_mama":
                category = "laudo_ultrassonografia"

            # Savepoint isolado para UploadedDocument (evita que constraints legadas de mime_type/size abortem o chat)
            try:
                async with db.begin_nested():
                    doc_record = UploadedDocument(
                        user_id=current_user.id,
                        thread_id=thread.id,
                        original_filename=validated_info["filename"],
                        file_size_bytes=min(len(content), 5242880),
                        mime_type=(
                            validated_info["detected_mime"]
                            if validated_info["detected_mime"] in (
                                "application/pdf",
                                "text/plain",
                                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            )
                            else "application/pdf"
                        ),
                        sha256_checksum=checksum,
                        extracted_text_anonymized=sanitized_text,
                        document_category=category,
                        birads_mentioned=birads_str,
                        ai_educational_analysis=reply_text,
                    )
                    db.add(doc_record)
                    await db.flush()
                    doc_id_str = str(doc_record.id)
            except Exception as doc_exc:
                logger.warning("Registro auxiliar UploadedDocument ignorado (%s); mantendo mensagens no chat.", doc_exc)

            user_rec = ChatMessage(
                thread_id=thread.id,
                sender_type="user",
                content=f"Enviei o arquivo para análise: {validated_info['filename']}",
                rag_references=[],
                created_at=now,
            )
            bot_rec = ChatMessage(
                thread_id=thread.id,
                sender_type="doutora_rosa",
                content=reply_text,
                detected_emotion="Análise de Imagem" if is_image_upload else "Análise de Exame",
                rag_references=[],
                used_fallback=False,
                created_at=now + timedelta(milliseconds=1),
            )
            db.add_all([user_rec, bot_rec])
            thread.last_message_at = now
            await db.commit()
            await db.refresh(user_rec)
            await db.refresh(bot_rec)
            user_msg_dto = serialize_chat_message(user_rec)
            bot_msg_dto = serialize_chat_message(bot_rec)
        except Exception as db_exc:
            logger.warning("Falha ao persistir histórico de upload no banco (%s); retornando análise diretamente.", db_exc)
            try:
                await db.rollback()
            except Exception:
                pass

    if user_msg_dto is None or bot_msg_dto is None:
        date_group_str = format_date_group(now)
        time_str = now.strftime("%H:%M")
        user_msg_dto = MessageResponse(
            id=str(uuid.uuid4()),
            date_group=date_group_str,
            time=time_str,
            sender="user",
            text=f"Enviei o arquivo para análise: {validated_info['filename']}",
            emotion_tag=None,
            doc_attachment=validated_info["filename"],
            psychological_support_triggered=False,
            rag_references=[],
            created_at=now,
        )
        bot_msg_dto = MessageResponse(
            id=str(uuid.uuid4()),
            date_group=date_group_str,
            time=time_str,
            sender="doutora_rosa",
            text=reply_text,
            emotion_tag="Análise Específica de Imagem • Doutora Rosa" if is_image_upload else "Análise de Exame • Doutora Rosa",
            doc_attachment=None,
            psychological_support_triggered=False,
            rag_references=[],
            created_at=now + timedelta(milliseconds=1),
        )

    preview = (sanitized_text[:250] + "...") if len(sanitized_text) > 250 else sanitized_text

    return DocumentAnalysisResponse(
        document_id=doc_id_str,
        filename=validated_info["filename"],
        lgpd_anonymized=True,
        extracted_preview=clean_rosa_text(preview),
        birads_detected=birads_str,
        educational_interpretation=reply_text,
        image_kind=image_kind,
        user_message=user_msg_dto,
        assistant_message=bot_msg_dto,
        medical_disclaimer=clean_disclaimer,
    )
