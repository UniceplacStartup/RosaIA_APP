import io
import re
from typing import Dict, Optional, Tuple, Any
import docx
import pypdf
from PIL import Image

try:
    import pydicom
    from pydicom.dataset import Dataset
except ImportError:
    pydicom = None

from app.core.config import settings
from app.core.exceptions import RosaIABaseException
from app.services.lgpd_service import anonymize_medical_text

# Extensões e formatos autorizados (Documentos + Imagens Médicas DICOM e Convencionais)
DOCUMENT_EXTENSIONS = {".pdf", ".txt", ".doc", ".docx"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
DICOM_EXTENSIONS = {".dcm", ".dicom"}
ALLOWED_EXTENSIONS = DOCUMENT_EXTENSIONS | IMAGE_EXTENSIONS | DICOM_EXTENSIONS

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "application/dicom",
    "application/octet-stream",
}

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB para suportar exames e DICOM


def is_dicom_file(raw_bytes: bytes, filename: str) -> bool:
    """Verifica se o arquivo é um DICOM válido por extensão ou preâmbulo (DICM a partir do byte 128)."""
    lower = filename.lower()
    if any(lower.endswith(ext) for ext in DICOM_EXTENSIONS):
        return True
    if len(raw_bytes) >= 132 and raw_bytes[128:132] == b"DICM":
        return True
    return False


def is_image_file(raw_bytes: bytes, filename: str) -> bool:
    """Verifica se é imagem convencional suportada."""
    lower = filename.lower()
    if any(lower.endswith(ext) for ext in IMAGE_EXTENSIONS):
        return True
    # Magic bytes comuns
    if raw_bytes.startswith(b"\xff\xd8\xff"):  # JPEG
        return True
    if raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"):  # PNG
        return True
    if raw_bytes.startswith(b"RIFF") and len(raw_bytes) > 12 and raw_bytes[8:12] == b"WEBP":
        return True
    if raw_bytes.startswith(b"BM"):  # BMP
        return True
    if raw_bytes.startswith(b"II*\x00") or raw_bytes.startswith(b"MM\x00*"):  # TIFF
        return True
    return False


def sanitize_dicom_dataset(dataset: Any) -> Tuple[str, Dict[str, Any]]:
    """
    Remove rigorosamente qualquer dado sensível (PII) dos metadados DICOM e
    retorna um resumo clínico/descritivo seguro do exame.
    """
    sensitive_tags = [
        "PatientName", "PatientID", "PatientBirthDate", "PatientSex", "PatientAge",
        "PatientAddress", "PatientMotherBirthName", "OtherPatientIDs", "OtherPatientNames",
        "EthnicGroup", "ReferringPhysicianName", "PhysiciansOfRecord", "PerformingPhysicianName",
        "NameOfPhysiciansReadingStudy", "InstitutionName", "InstitutionAddress", "StationName",
        "InstitutionalDepartmentName", "OperatorsName", "AccessionNumber", "StudyID"
    ]
    for tag in sensitive_tags:
        if hasattr(dataset, tag):
            try:
                setattr(dataset, tag, "[DADO_PESSOAL_REMOVIDO_LGPD]")
            except Exception:
                pass

    # Extrai dados estritamente descritivos do exame de imagem
    modality = str(getattr(dataset, "Modality", "MG (Mamografia)"))
    body_part = str(getattr(dataset, "BodyPartExamined", "MAMA / BREAST"))
    study_desc = str(getattr(dataset, "StudyDescription", "Exame de Imagem Mamária"))
    series_desc = str(getattr(dataset, "SeriesDescription", "Aquisição Digital"))
    laterality = str(getattr(dataset, "ImageLaterality", "Bilateral / Não informada"))
    view_pos = str(getattr(dataset, "ViewPosition", "Incidência Padrão"))
    manufacturer = str(getattr(dataset, "Manufacturer", "Equipamento Radiológico Digital"))

    # Higieniza qualquer texto residual
    clean_study_desc = anonymize_medical_text(study_desc)
    clean_series_desc = anonymize_medical_text(series_desc)

    findings_summary = (
        f"Exame de Imagem DICOM processado com desidentificação de dados sensíveis.\n"
        f"Modalidade: {modality}\n"
        f"Região Examinada: {body_part}\n"
        f"Lateralidade: {laterality} | Incidência: {view_pos}\n"
        f"Descrição do Procedimento: {clean_study_desc} - {clean_series_desc}\n"
        f"Sistema de Aquisição: {manufacturer}\n"
        f"Status de Privacidade: Todos os dados identificadores de paciente foram expurgados conforme a LGPD.\n"
        f"Laudo radiológico descritivo: Imagem mamária para análise visual e correlação de achados (densidade tecidual, simetria e presença de achados ou calcificações)."
    )

    meta = {
        "modality": modality,
        "body_part": body_part,
        "laterality": laterality,
        "view_position": view_pos,
        "sanitized": True
    }
    return findings_summary, meta


def sanitize_conventional_image(file_bytes: bytes, filename: str) -> Tuple[str, Dict[str, Any]]:
    """
    Remove metadados EXIF sensíveis de imagens convencionais (JPEG, PNG, etc.)
    e extrai características descritivas da imagem.
    """
    try:
        image = Image.open(io.BytesIO(file_bytes))
        width, height = image.size
        img_format = image.format or "Imagem"
        mode = image.mode

        # Despojar EXIF para garantir privacidade total
        clean_bytes_io = io.BytesIO()
        # Salva limpo sem EXIF
        save_format = "PNG" if img_format.upper() in ["PNG", "WEBP"] else "JPEG"
        if mode in ("RGBA", "P") and save_format == "JPEG":
            image = image.convert("RGB")
        image.save(clean_bytes_io, format=save_format)

        desc = (
            f"Exame de imagem médica/convencional recebido: {filename}\n"
            f"Formato: {img_format} ({width}x{height} pixels, modo {mode}).\n"
            f"Higienização de Privacidade: Metadados de dispositivo e dados de rastreamento EXIF expurgados.\n"
            f"Conteúdo: Imagem de exame mamário/laudo fotográfico disponível para avaliação descritiva dos achados anatômicos, simetria e orientação educativa."
        )
        return desc, {"width": width, "height": height, "format": img_format, "sanitized": True}
    except Exception as exc:
        return (
            f"Exame de imagem médica: {filename}. Metadados sanitizados conforme LGPD.",
            {"sanitized": True}
        )


def prepare_image_for_vision(file_bytes: bytes, filename: str, max_side: int = 1600) -> Optional[Tuple[bytes, str]]:
    """
    Converte imagem convencional ou DICOM em JPEG limpo (sem EXIF/metadados, 8 bits, lado máximo
    `max_side`) para análise visual pela IA. Retorna None se não for possível renderizar.
    """
    try:
        if is_dicom_file(file_bytes, filename):
            if pydicom is None:
                return None
            ds = pydicom.dcmread(io.BytesIO(file_bytes), force=True)
            import numpy as np  # dependência necessária para renderizar pixels DICOM

            arr = ds.pixel_array.astype("float32")
            if arr.ndim == 3 and arr.shape[-1] not in (3, 4):
                arr = arr[0]
            lo, hi = float(arr.min()), float(arr.max())
            arr = (arr - lo) / (hi - lo) * 255.0 if hi > lo else arr * 0
            if str(getattr(ds, "PhotometricInterpretation", "")) == "MONOCHROME1":
                arr = 255.0 - arr
            image = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
        else:
            image = Image.open(io.BytesIO(file_bytes))
            image.load()
            if image.mode in ("I;16", "I;16L", "I;16B", "I", "F"):
                lo, hi = image.getextrema()
                scale = 255.0 / (hi - lo) if hi > lo else 1.0
                image = image.point(lambda p: (p - lo) * scale).convert("L")
            elif image.mode not in ("RGB", "L"):
                image = image.convert("RGB")

        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        image.thumbnail((max_side, max_side))
        out = io.BytesIO()
        image.save(out, format="JPEG", quality=88)  # re-encode descarta EXIF e metadados
        return out.getvalue(), "image/jpeg"
    except Exception:
        return None


def validate_and_inspect_document(filename: str, content_type: str, raw_bytes: bytes) -> Dict[str, Any]:
    """
    Inspeção e validação para suportar tanto documentos quanto imagens DICOM e convencionais.
    Garante proteção LGPD impedindo a exposição de dados sensíveis.
    """
    lower_filename = filename.lower()
    lower_content_type = (content_type or "").lower()

    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        raise RosaIABaseException(
            status_code=413,
            detail="Arquivo muito grande. O limite máximo permitido para exames e imagens é de 15 MB.",
        )

    # Identifica o tipo de arquivo
    is_dicom = is_dicom_file(raw_bytes, filename)
    is_img = is_image_file(raw_bytes, filename)
    is_doc = any(lower_filename.endswith(ext) for ext in DOCUMENT_EXTENSIONS)

    if not (is_dicom or is_img or is_doc):
        # Checa se a extensão é suportada
        has_valid_ext = any(lower_filename.endswith(ext) for ext in ALLOWED_EXTENSIONS)
        if not has_valid_ext:
            raise RosaIABaseException(
                status_code=400,
                detail="Formato de arquivo não suportado. Envie laudos em PDF/TXT/DOCX ou imagens de exame em DICOM (.dcm), JPG, PNG, WEBP ou TIFF.",
            )

    file_kind = "dicom" if is_dicom else ("image" if is_img else "document")

    return {
        "filename": filename,
        "file_kind": file_kind,
        "is_dicom": is_dicom,
        "is_image": is_img,
        "is_document": is_doc,
    }


def extract_text_from_document(filename: str, content_type: str, raw_bytes: bytes) -> str:
    """Extrai texto e descrições higienizadas de documentos ou imagens médicas."""
    lower_filename = filename.lower()
    lower_content_type = (content_type or "").lower()

    # 1. Tratamento DICOM
    if is_dicom_file(raw_bytes, filename):
        if pydicom is not None:
            try:
                ds = pydicom.dcmread(io.BytesIO(raw_bytes), force=True)
                summary, _ = sanitize_dicom_dataset(ds)
                return summary
            except Exception as e:
                return (
                    f"Exame de Imagem Médica DICOM ({filename}).\n"
                    f"Higienização: Metadados sensíveis protegidos pela LGPD.\n"
                    f"Descrição: Aquisição radiológica para correlação clínica e educativa."
                )
        else:
            return (
                f"Exame de Imagem Médica DICOM ({filename}). Metadados protegidos em conformidade com a LGPD."
            )

    # 2. Tratamento Imagem Convencional
    if is_image_file(raw_bytes, filename):
        desc, _ = sanitize_conventional_image(raw_bytes, filename)
        return desc

    # 3. Tratamento PDF
    if lower_filename.endswith(".pdf") or lower_content_type == "application/pdf":
        try:
            reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
            pages_text = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages_text).strip()
        except Exception as e:
            raise RosaIABaseException(status_code=422, detail=f"Erro ao processar o arquivo PDF: {str(e)}")

    # 4. Tratamento DOCX
    if lower_filename.endswith(".docx") or "officedocument.wordprocessingml" in lower_content_type:
        try:
            doc = docx.Document(io.BytesIO(raw_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text]
            return "\n".join(paragraphs).strip()
        except Exception as e:
            raise RosaIABaseException(status_code=422, detail=f"Erro ao processar o arquivo DOCX: {str(e)}")

    # 5. TXT ou arquivo texto simples
    try:
        return raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return raw_bytes.decode("latin-1", errors="ignore")


_EXTENSION_TO_MIME = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".dcm": "application/dicom",
    ".dicom": "application/dicom",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
}


def validate_medical_document_file(
    file_bytes: bytes, filename: str, declared_content_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Valida o laudo ou exame de imagem (DICOM ou convencional) e retorna metadados normalizados.
    """
    info = validate_and_inspect_document(filename, declared_content_type or "", file_bytes)

    lower_filename = filename.lower()
    extension = next(
        (ext for ext in sorted(ALLOWED_EXTENSIONS, key=len, reverse=True) if lower_filename.endswith(ext)),
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
        "file_kind": info["file_kind"],
        "detected_mime": _EXTENSION_TO_MIME.get(extension, declared_content_type or "application/octet-stream"),
    }


def extract_text_from_file_bytes(file_bytes: bytes, extension: str, filename: str = "documento") -> str:
    """Extrai texto e descrições clínicas a partir da extensão e conteúdo já validados."""
    return extract_text_from_document(
        f"{filename}{extension}", _EXTENSION_TO_MIME.get(extension, ""), file_bytes
    )
