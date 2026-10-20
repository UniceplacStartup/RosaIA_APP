import io
from typing import Dict, Optional, Tuple

import docx
import pypdf

from app.core.config import settings
from app.core.exceptions import LGPDImageBlockedException, RosaIABaseException

# Assinaturas binárias reais (Magic Bytes) de imagens e formatos proibidos
FORBIDDEN_IMAGE_SIGNATURES = [
    (b"\xff\xd8\xff", "JPEG"),
    (b"\x89PNG\r\n\x1a\n", "PNG"),
    (b"GIF87a", "GIF"),
    (b"GIF89a", "GIF"),
    (b"RIFF", "WEBP/RIFF"),
    (b"BM", "BMP"),
    (b"II*\x00", "TIFF"),
    (b"MM\x00*", "TIFF"),
]

ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".txt", ".doc", ".docx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}


def validate_and_inspect_document(filename: str, content_type: str, raw_bytes: bytes) -> None:
    """
    Inspeção profunda de cabeçalhos e Magic Bytes.
    Rejeita terminantemente qualquer imagem médica com HTTP 415 (LGPD).
    """
    lower_filename = filename.lower()
    lower_content_type = (content_type or "").lower()

    # 1. Checagem por MIME Type declarado
    if lower_content_type.startswith("image/") or lower_content_type == "application/dicom":
        raise LGPDImageBlockedException()

    # 2. Checagem por extensão
    is_image_ext = any(
        lower_filename.endswith(ext)
        for ext in [
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic",
            ".heif", ".avif", ".svg", ".tif", ".tiff", ".dcm", ".dicom",
        ]
    )
    if is_image_ext:
        raise LGPDImageBlockedException()

    # 3. Limite de tamanho
    if len(raw_bytes) > settings.MAX_DOCUMENT_SIZE_BYTES:
        raise RosaIABaseException(
            status_code=413,
            detail="Arquivo muito grande. O limite máximo permitido para documentos é de 5 MB.",
        )

    # 4. Inspeção de Magic Bytes (binário real)
    for sig, _name in FORBIDDEN_IMAGE_SIGNATURES:
        if raw_bytes.startswith(sig):
            raise LGPDImageBlockedException()

    # Inspeção de cabeçalho DICOM (Preamble de 128 bytes + 'DICM')
    if len(raw_bytes) >= 132 and raw_bytes[128:132] == b"DICM":
        raise LGPDImageBlockedException()

    # Inspeção de HEIC/AVIF (ftyp no byte 4)
    if len(raw_bytes) >= 12 and raw_bytes[4:8] == b"ftyp":
        brand = raw_bytes[8:12]
        if brand in [b"heic", b"heix", b"mif1", b"avif"]:
            raise LGPDImageBlockedException()

    # 5. Validação de extensão permitida
    has_valid_ext = any(lower_filename.endswith(ext) for ext in ALLOWED_DOCUMENT_EXTENSIONS)
    if not has_valid_ext:
        raise RosaIABaseException(
            status_code=400,
            detail="Formato de documento não suportado. Envie apenas arquivos .pdf, .txt ou .docx.",
        )


def extract_text_from_document(filename: str, content_type: str, raw_bytes: bytes) -> str:
    """Extrai texto puro de PDF, DOCX ou TXT com tratamento de falhas e encoding."""
    lower_filename = filename.lower()
    lower_content_type = (content_type or "").lower()

    if lower_filename.endswith(".pdf") or lower_content_type == "application/pdf":
        try:
            reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
            pages_text = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages_text).strip()
        except Exception as e:
            raise RosaIABaseException(status_code=422, detail=f"Erro ao processar o arquivo PDF: {str(e)}")

    if lower_filename.endswith(".docx") or "officedocument.wordprocessingml" in lower_content_type:
        try:
            doc = docx.Document(io.BytesIO(raw_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text]
            return "\n".join(paragraphs).strip()
        except Exception as e:
            raise RosaIABaseException(status_code=422, detail=f"Erro ao processar o arquivo DOCX: {str(e)}")

    # TXT ou arquivo texto simples
    try:
        return raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return raw_bytes.decode("latin-1", errors="ignore")


_EXTENSION_TO_MIME = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
}


def validate_medical_document_file(
    file_bytes: bytes, filename: str, declared_content_type: Optional[str] = None
) -> Dict[str, str]:
    """
    Valida o documento (bloqueio LGPD de imagens + Magic Bytes) e retorna metadados normalizados
    usados pelo endpoint de upload.
    """
    validate_and_inspect_document(filename, declared_content_type or "", file_bytes)

    lower_filename = filename.lower()
    extension = next(
        (ext for ext in sorted(ALLOWED_DOCUMENT_EXTENSIONS, key=len, reverse=True) if lower_filename.endswith(ext)),
        "",
    )
    if extension == ".pdf" and not file_bytes.startswith(b"%PDF"):
        raise RosaIABaseException(
            status_code=400,
            detail="O conteúdo do arquivo não corresponde a um PDF válido.",
        )

    return {
        "filename": filename,
        "extension": extension,
        "detected_mime": _EXTENSION_TO_MIME.get(extension, declared_content_type or "application/octet-stream"),
    }


def extract_text_from_file_bytes(file_bytes: bytes, extension: str) -> str:
    """Extrai texto a partir da extensão já validada."""
    return extract_text_from_document(
        f"documento{extension}", _EXTENSION_TO_MIME.get(extension, ""), file_bytes
    )
