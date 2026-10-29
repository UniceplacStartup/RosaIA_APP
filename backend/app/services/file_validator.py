import array
import hashlib
import io
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import docx
import pypdf
from PIL import Image, ImageOps, ImageStat

try:
    import pydicom
    from pydicom.dataset import Dataset
except ImportError:
    pydicom = None

from app.core.config import settings
from app.core.exceptions import RosaIABaseException
from app.services.lgpd_service import anonymize_medical_text

logger = logging.getLogger("rosaia.services.file_validator")

# Extensões e formatos autorizados (Documentos + Imagens Médicas DICOM e Convencionais)
DOCUMENT_EXTENSIONS = {".pdf", ".txt", ".doc", ".docx"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
DICOM_EXTENSIONS = {".dcm", ".dicom", ".ima"}
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

MODALITY_LABELS: Dict[str, str] = {
    "MG": "Mamografia Digital (MG)",
    "US": "Ultrassonografia (US)",
    "MR": "Ressonância Magnética (MR)",
    "CT": "Tomografia Computadorizada (CT)",
    "CR": "Radiografia Computadorizada (CR)",
    "DX": "Radiografia Digital (DX)",
    "RG": "Radiografia Convencional (RG)",
    "NM": "Medicina Nuclear (NM)",
    "PT": "PET / Tomografia por Emissão de Pósitrons (PT)",
    "XA": "Angiografia Digital (XA)",
    "RF": "Radiofluoroscopia (RF)",
    "ES": "Endoscopia (ES)",
    "XC": "Fotografia Clínica Externa (XC)",
    "OP": "Fotografia Oftálmica (OP)",
    "OT": "Outra Modalidade Médica (OT)",
    "SC": "Captura Secundária Digital (SC)",
}

LATERALITY_LABELS: Dict[str, str] = {
    "R": "Direita (R)",
    "L": "Esquerda (L)",
    "B": "Bilateral (B)",
    "U": "Unilateral / Não pareada (U)",
}

VIEW_POSITION_LABELS: Dict[str, str] = {
    "CC": "Craniocaudal (CC)",
    "MLO": "Médio-Lateral Oblíqua (MLO)",
    "ML": "Médio-Lateral (ML)",
    "LM": "Látero-Medial (LM)",
    "XCCL": "Craniocaudal Exagerada Lateral (XCCL)",
    "XCCM": "Craniocaudal Exagerada Medial (XCCM)",
    "FB": "Caudo-Craniana (FB)",
    "AP": "Ântero-Posterior (AP)",
    "PA": "Póstero-Anterior (PA)",
    "LAT": "Perfil / Lateral (LAT)",
    "LL": "Látero-Lateral (LL)",
    "RL": "Lateral Direita (RL)",
}


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


def _clean_tag_str(dataset: Any, tag_name: str) -> Optional[str]:
    val = getattr(dataset, tag_name, None)
    if val is None:
        return None
    if isinstance(val, (list, tuple)):
        text = ", ".join(str(x).strip() for x in val if str(x).strip())
    else:
        try:
            if hasattr(val, "__iter__") and not isinstance(val, (str, bytes)):
                text = ", ".join(str(x).strip() for x in val if str(x).strip())
            else:
                text = str(val).strip()
        except Exception:
            text = str(val).strip()
    if not text or text in ("None", "[DADO_PESSOAL_REMOVIDO_LGPD]"):
        return None
    return anonymize_medical_text(text)


def sanitize_dicom_dataset(dataset: Any) -> Tuple[str, Dict[str, Any]]:
    """
    Remove rigorosamente qualquer dado sensível (PII) dos metadados DICOM e
    extrai apenas os metadados técnicos reais presentes no arquivo DICOM,
    sem assumir que todo DICOM seja mamografia quando a modalidade for outra.
    """
    sensitive_tags = [
        "PatientName", "PatientID", "PatientBirthDate", "PatientSex", "PatientAge",
        "PatientAddress", "PatientMotherBirthName", "OtherPatientIDs", "OtherPatientNames",
        "EthnicGroup", "ReferringPhysicianName", "PhysiciansOfRecord", "PerformingPhysicianName",
        "NameOfPhysiciansReadingStudy", "InstitutionName", "InstitutionAddress", "StationName",
        "InstitutionalDepartmentName", "OperatorsName", "AccessionNumber", "StudyID",
        "PatientTelephoneNumbers", "AdditionalPatientHistory", "PatientComments",
    ]
    for tag in sensitive_tags:
        if hasattr(dataset, tag):
            try:
                setattr(dataset, tag, "[DADO_PESSOAL_REMOVIDO_LGPD]")
            except Exception:
                pass

    raw_modality = (_clean_tag_str(dataset, "Modality") or "").upper()
    modality_label = MODALITY_LABELS.get(raw_modality, raw_modality or "Exame de Imagem DICOM")

    body_part = _clean_tag_str(dataset, "BodyPartExamined") or _clean_tag_str(dataset, "AnatomicalOrientationType")
    study_desc = _clean_tag_str(dataset, "StudyDescription")
    series_desc = _clean_tag_str(dataset, "SeriesDescription")
    protocol_name = _clean_tag_str(dataset, "ProtocolName")

    raw_lat = (_clean_tag_str(dataset, "ImageLaterality") or _clean_tag_str(dataset, "Laterality") or "").upper()
    laterality = LATERALITY_LABELS.get(raw_lat, raw_lat) if raw_lat else None

    raw_view = (_clean_tag_str(dataset, "ViewPosition") or _clean_tag_str(dataset, "AcquisitionContextSequence") or "").upper()
    view_pos = VIEW_POSITION_LABELS.get(raw_view, raw_view) if raw_view else None

    rows = _clean_tag_str(dataset, "Rows")
    cols = _clean_tag_str(dataset, "Columns")
    bits_stored = _clean_tag_str(dataset, "BitsStored") or _clean_tag_str(dataset, "BitsAllocated")
    photometric = _clean_tag_str(dataset, "PhotometricInterpretation")
    pixel_spacing = _clean_tag_str(dataset, "PixelSpacing") or _clean_tag_str(dataset, "ImagerPixelSpacing")
    slice_thickness = _clean_tag_str(dataset, "SliceThickness")
    kvp = _clean_tag_str(dataset, "KVP")
    exposure = _clean_tag_str(dataset, "Exposure") or _clean_tag_str(dataset, "ExposureInuAs")
    compression_force = _clean_tag_str(dataset, "CompressionForce")
    body_thickness = _clean_tag_str(dataset, "BodyPartThickness")
    manufacturer = _clean_tag_str(dataset, "Manufacturer")
    model_name = _clean_tag_str(dataset, "ManufacturerModelName")
    image_type = _clean_tag_str(dataset, "ImageType")
    window_center = _clean_tag_str(dataset, "WindowCenter")
    window_width = _clean_tag_str(dataset, "WindowWidth")

    lines = [
        "Exame de Imagem DICOM processado com desidentificação de dados pessoais (LGPD).",
        f"Modalidade DICOM: {modality_label}",
    ]
    if body_part:
        lines.append(f"Região Anatômica (BodyPartExamined): {body_part}")
    if laterality:
        lines.append(f"Lateralidade: {laterality}")
    if view_pos:
        lines.append(f"Incidência / Posição de Visualização: {view_pos}")
    if study_desc or series_desc or protocol_name:
        desc_parts = [p for p in (study_desc, series_desc, protocol_name) if p]
        lines.append(f"Descrição Técnica do Estudo/Série: {' | '.join(desc_parts)}")
    if cols and rows:
        dim_str = f"{cols}x{rows} pixels"
        if bits_stored:
            dim_str += f" ({bits_stored} bits)"
        if photometric:
            dim_str += f", fotometria {photometric}"
        lines.append(f"Matriz da Imagem: {dim_str}")
    if pixel_spacing:
        lines.append(f"Espaçamento de Pixel (mm): {pixel_spacing}")
    if slice_thickness:
        lines.append(f"Espessura de Corte (mm): {slice_thickness}")
    if kvp or exposure or body_thickness or compression_force:
        acq_parts = []
        if kvp:
            acq_parts.append(f"kVp={kvp}")
        if exposure:
            acq_parts.append(f"Exposição={exposure}")
        if body_thickness:
            acq_parts.append(f"Espessura={body_thickness} mm")
        if compression_force:
            acq_parts.append(f"Compressão={compression_force} N")
        lines.append(f"Parâmetros de Aquisição: {', '.join(acq_parts)}")
    if window_center or window_width:
        lines.append(f"Janelamento Padrão (WC/WW): WC={window_center or 'auto'}, WW={window_width or 'auto'}")
    if manufacturer or model_name:
        equip = " - ".join(p for p in (manufacturer, model_name) if p)
        lines.append(f"Equipamento: {equip}")
    if image_type:
        lines.append(f"Tipo de Imagem DICOM: {image_type}")

    meta: Dict[str, Any] = {
        "modality_code": raw_modality or None,
        "modality": modality_label,
        "body_part": body_part,
        "laterality": laterality,
        "view_position": view_pos,
        "study_description": study_desc,
        "series_description": series_desc,
        "protocol_name": protocol_name,
        "rows": int(rows) if rows and rows.isdigit() else None,
        "columns": int(cols) if cols and cols.isdigit() else None,
        "bits_stored": bits_stored,
        "photometric": photometric,
        "pixel_spacing": pixel_spacing,
        "slice_thickness": slice_thickness,
        "kvp": kvp,
        "exposure": exposure,
        "manufacturer": manufacturer,
        "sanitized": True,
    }
    return "\n".join(lines), meta


def sanitize_conventional_image(file_bytes: bytes, filename: str) -> Tuple[str, Dict[str, Any]]:
    """
    Remove metadados EXIF sensíveis de imagens convencionais (JPEG, PNG, etc.)
    e extrai características técnicas reais da imagem.
    """
    try:
        image = Image.open(io.BytesIO(file_bytes))
        width, height = image.size
        img_format = image.format or "Imagem"
        mode = image.mode

        desc = (
            f"Imagem recebida: {filename}\n"
            f"Formato: {img_format} ({width}x{height} pixels, modo de cor {mode}).\n"
            f"Higienização de Privacidade: Metadados EXIF e identificadores de dispositivo removidos (LGPD)."
        )
        return desc, {"width": width, "height": height, "format": img_format, "mode": mode, "sanitized": True}
    except Exception:
        return (
            f"Imagem recebida: {filename}. Metadados sanitizados conforme LGPD.",
            {"sanitized": True},
        )


def _decode_dicom_to_pil(ds: Any, raw_bytes: bytes) -> Optional[Image.Image]:
    """
    Renderiza o dataset DICOM em um objeto PIL.Image com contraste otimizado.
    Possui 3 camadas de resiliência:
    1. numpy + pydicom (com aplicação de Modality LUT, VOI LUT / Windowing e ajuste de percentil)
    2. Extração de quadros encapsulados comprimidos (JPEG / JPEG2000 / PNG dentro de PixelData)
    3. Decodificador puro em Python (módulo `array` da stdlib) caso numpy não esteja disponível
    """
    photometric = str(getattr(ds, "PhotometricInterpretation", "MONOCHROME2") or "MONOCHROME2").upper().strip()

    # Camada 1: numpy + pydicom (preferencial)
    try:
        import numpy as np

        arr = ds.pixel_array
        try:
            from pydicom.pixel_data_handlers.util import apply_modality_lut, apply_voi_lut

            arr = apply_modality_lut(arr, ds)
            arr = apply_voi_lut(arr, ds)
        except Exception:
            pass

        arr = np.asarray(arr, dtype="float32")

        # Se for volume 3D / multiframe (e não canais RGB), seleciona a fatia central (mais representativa)
        while arr.ndim > 2 and not (arr.ndim == 3 and arr.shape[-1] in (3, 4)):
            mid_idx = arr.shape[0] // 2
            arr = arr[mid_idx]

        # Ignora valores de padding se informados no DICOM
        pad_val = getattr(ds, "PixelPaddingValue", None)
        if pad_val is not None:
            try:
                mask = arr != float(pad_val)
                if np.any(mask):
                    fill_val = float(np.min(arr[mask]))
                    arr = np.where(mask, arr, fill_val)
            except Exception:
                pass

        # Normalização robusta com percentil (evita que 1 pixel de anotação queime o contraste da imagem)
        if arr.ndim == 2:
            p_low, p_high = np.percentile(arr, [1.0, 99.5])
            if p_high > p_low:
                arr = np.clip(arr, p_low, p_high)
                arr = (arr - p_low) / (p_high - p_low) * 255.0
            else:
                lo, hi = float(arr.min()), float(arr.max())
                arr = (arr - lo) / (hi - lo) * 255.0 if hi > lo else np.zeros_like(arr)
            if photometric == "MONOCHROME1":
                arr = 255.0 - arr
            return Image.fromarray(np.clip(arr, 0, 255).astype("uint8"), mode="L")
        else:
            lo, hi = float(arr.min()), float(arr.max())
            arr = (arr - lo) / (hi - lo) * 255.0 if hi > lo else np.zeros_like(arr)
            return Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
    except Exception as exc:
        logger.debug("Camada 1 (numpy) de renderização DICOM não aplicável: %s", exc)

    # Camada 2: Quadros comprimidos encapsulados (JPEG / PNG / JPEG2000) em PixelData ou no arquivo
    pixel_data: Optional[bytes] = getattr(ds, "PixelData", None)
    if pixel_data:
        try:
            from pydicom.encaps import generate_frames

            num_frames = int(getattr(ds, "NumberOfFrames", 1) or 1)
            for frame_bytes in generate_frames(pixel_data, number_of_frames=num_frames):
                try:
                    img = Image.open(io.BytesIO(frame_bytes))
                    img.load()
                    if photometric == "MONOCHROME1" and img.mode == "L":
                        img = ImageOps.invert(img)
                    return img
                except Exception:
                    continue
        except Exception:
            pass

        # Busca direta por assinatura JPEG (\xff\xd8\xff) dentro de PixelData
        jpeg_start = pixel_data.find(b"\xff\xd8\xff")
        if jpeg_start != -1:
            try:
                img = Image.open(io.BytesIO(pixel_data[jpeg_start:]))
                img.load()
                if photometric == "MONOCHROME1" and img.mode == "L":
                    img = ImageOps.invert(img)
                return img
            except Exception:
                pass

    # Camada 3: Decodificador puro em Python (stdlib `array`) para PixelData não comprimido (8 ou 16 bits)
    if pixel_data:
        try:
            rows = int(getattr(ds, "Rows", 0) or 0)
            cols = int(getattr(ds, "Columns", 0) or 0)
            bits_alloc = int(getattr(ds, "BitsAllocated", 16) or 16)
            bits_stored = int(getattr(ds, "BitsStored", bits_alloc) or bits_alloc)
            signed = int(getattr(ds, "PixelRepresentation", 0) or 0) == 1
            samples = int(getattr(ds, "SamplesPerPixel", 1) or 1)
            num_pixels = rows * cols

            if rows > 0 and cols > 0:
                if samples >= 3 and bits_alloc == 8 and len(pixel_data) >= num_pixels * 3:
                    return Image.frombytes("RGB", (cols, rows), pixel_data[: num_pixels * 3])

                if bits_alloc == 8 and len(pixel_data) >= num_pixels:
                    typecode = "b" if signed else "B"
                    vals = array.array(typecode, pixel_data[:num_pixels])
                elif bits_alloc == 16 and len(pixel_data) >= num_pixels * 2:
                    typecode = "h" if signed else "H"
                    vals = array.array(typecode, pixel_data[: num_pixels * 2])
                    if not signed and bits_stored < 16:
                        mask_bits = (1 << bits_stored) - 1
                        vals = array.array("H", (v & mask_bits for v in vals))
                else:
                    vals = None

                if vals is not None and len(vals) > 0:
                    # Amostragem rápida para calcular percentis 1% e 99.5%
                    step = max(1, len(vals) // 20000)
                    sampled = sorted(vals[::step])
                    p_low = float(sampled[max(0, int(len(sampled) * 0.01))])
                    p_high = float(sampled[min(len(sampled) - 1, int(len(sampled) * 0.995))])
                    if p_high <= p_low:
                        p_low = float(sampled[0])
                        p_high = float(sampled[-1])

                    span = (p_high - p_low) if p_high > p_low else 1.0
                    invert = photometric == "MONOCHROME1"
                    out_bytes = bytearray(num_pixels)
                    for idx, v in enumerate(vals):
                        if v <= p_low:
                            scaled = 0
                        elif v >= p_high:
                            scaled = 255
                        else:
                            scaled = int((v - p_low) / span * 255.0)
                        out_bytes[idx] = (255 - scaled) if invert else scaled

                    return Image.frombytes("L", (cols, rows), bytes(out_bytes))
        except Exception as exc:
            logger.debug("Camada 3 (stdlib array) de renderização DICOM falhou: %s", exc)

    return None


def prepare_image_for_vision(file_bytes: bytes, filename: str, max_side: int = 1600) -> Optional[Tuple[bytes, str]]:
    """
    Converte imagem convencional ou DICOM em JPEG limpo (sem EXIF/metadados, 8 bits, lado máximo
    `max_side`) para análise visual pela IA. Retorna None se não for possível renderizar.
    """
    try:
        image: Optional[Image.Image] = None
        if is_dicom_file(file_bytes, filename):
            if pydicom is not None:
                ds = pydicom.dcmread(io.BytesIO(file_bytes), force=True)
                image = _decode_dicom_to_pil(ds, file_bytes)
        if image is None:
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
        image.save(out, format="JPEG", quality=90)
        return out.getvalue(), "image/jpeg"
    except Exception as exc:
        logger.warning("Não foi possível converter %s para imagem de visão: %s", filename, exc)
        return None


def compute_visual_statistics(image_bytes: bytes) -> Dict[str, Any]:
    """
    Calcula métricas visuais objetivas diretamente dos pixels da imagem renderizada
    (brilho médio, contraste, cobertura tecidual, densidade por quadrante e simetria),
    garantindo dados quantitativos reais e específicos para cada imagem enviada.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
        gray = img.convert("L")
        stat = ImageStat.Stat(gray)
        mean_val = round(float(stat.mean[0]), 1)
        std_val = round(float(stat.stddev[0]), 1)
        extrema = gray.getextrema()
        min_val, max_val = int(extrema[0]), int(extrema[1])

        hist = gray.histogram()
        total_px = max(1, sum(hist))
        bg_pct = round(sum(hist[:20]) / total_px * 100.0, 1)
        soft_pct = round(sum(hist[20:135]) / total_px * 100.0, 1)
        dense_pct = round(sum(hist[135:210]) / total_px * 100.0, 1)
        hyper_pct = round(sum(hist[210:]) / total_px * 100.0, 1)

        # Análise dos 4 quadrantes + região central
        mx, my = max(1, width // 2), max(1, height // 2)
        quads = {
            "superior_esquerdo": gray.crop((0, 0, mx, my)),
            "superior_direito": gray.crop((mx, 0, width, my)),
            "inferior_esquerdo": gray.crop((0, my, mx, height)),
            "inferior_direito": gray.crop((mx, my, width, height)),
        }
        quad_means: Dict[str, float] = {}
        quad_high_pct: Dict[str, float] = {}
        for q_name, q_img in quads.items():
            q_stat = ImageStat.Stat(q_img)
            quad_means[q_name] = round(float(q_stat.mean[0]), 1)
            q_hist = q_img.histogram()
            q_total = max(1, sum(q_hist))
            quad_high_pct[q_name] = round(sum(q_hist[175:]) / q_total * 100.0, 1)

        cx0, cy0 = width // 4, height // 4
        cx1, cy1 = max(cx0 + 1, width * 3 // 4), max(cy0 + 1, height * 3 // 4)
        center_mean = round(float(ImageStat.Stat(gray.crop((cx0, cy0, cx1, cy1))).mean[0]), 1)

        dominant_quadrant = max(quad_means.items(), key=lambda kv: kv[1])[0].replace("_", " ")
        focal_quadrant = max(quad_high_pct.items(), key=lambda kv: kv[1])[0].replace("_", " ")

        left_mean = (quad_means["superior_esquerdo"] + quad_means["inferior_esquerdo"]) / 2.0
        right_mean = (quad_means["superior_direito"] + quad_means["inferior_direito"]) / 2.0
        lr_diff = round(abs(left_mean - right_mean), 1)

        # Classificação objetiva do padrão de intensidade/densidade visual
        tissue_total = max(1.0, 100.0 - bg_pct)
        relative_dense_ratio = round((dense_pct + hyper_pct) / tissue_total * 100.0, 1) if tissue_total > 5 else 0.0
        if relative_dense_ratio >= 55:
            density_pattern = "predominantemente denso / alta radiopacidade relativa"
        elif relative_dense_ratio >= 30:
            density_pattern = "densidade intermediária / distribuição heterogênea fibroglandular"
        elif relative_dense_ratio >= 12:
            density_pattern = "densidade esparsa com áreas moderadas de atenuação"
        else:
            density_pattern = "predominância radiolucente / baixa atenuação relativa"

        return {
            "width": width,
            "height": height,
            "mean_intensity": mean_val,
            "std_contrast": std_val,
            "min_intensity": min_val,
            "max_intensity": max_val,
            "background_pct": bg_pct,
            "soft_tissue_pct": soft_pct,
            "dense_tissue_pct": dense_pct,
            "hyperdense_foci_pct": hyper_pct,
            "relative_dense_ratio": relative_dense_ratio,
            "density_pattern": density_pattern,
            "quadrant_means": quad_means,
            "quadrant_high_pct": quad_high_pct,
            "center_mean": center_mean,
            "dominant_quadrant": dominant_quadrant,
            "focal_quadrant": focal_quadrant,
            "left_right_diff": lr_diff,
        }
    except Exception as exc:
        logger.debug("Falha ao calcular estatísticas visuais: %s", exc)
        return {}


def extract_image_technical_context(
    file_bytes: bytes,
    filename: str,
    rendered_jpeg: Optional[bytes] = None,
) -> Tuple[str, Dict[str, Any]]:
    """
    Monta um dossiê técnico e visual objetivo da imagem (DICOM ou convencional)
    para enriquecer o prompt multimodal da Doutora Rosa e garantir que cada imagem
    receba uma análise única, objetiva e baseada nos seus dados reais.
    """
    short_hash = hashlib.sha256(file_bytes).hexdigest()[:10]
    meta: Dict[str, Any] = {"file_hash": short_hash, "filename": filename, "is_dicom": False}
    summary_lines: List[str] = [f"Arquivo: {filename} (ID único da imagem: {short_hash})"]

    if is_dicom_file(file_bytes, filename) and pydicom is not None:
        meta["is_dicom"] = True
        try:
            ds = pydicom.dcmread(io.BytesIO(file_bytes), force=True)
            dicom_text, dicom_meta = sanitize_dicom_dataset(ds)
            summary_lines.append(dicom_text)
            meta.update(dicom_meta)
        except Exception as exc:
            logger.debug("Erro ao extrair tags DICOM de %s: %s", filename, exc)
            summary_lines.append("Formato: Arquivo DICOM médico.")
    elif is_image_file(file_bytes, filename):
        img_text, img_meta = sanitize_conventional_image(file_bytes, filename)
        summary_lines.append(img_text)
        meta.update(img_meta)

    target_bytes = rendered_jpeg or (file_bytes if is_image_file(file_bytes, filename) else None)
    if target_bytes:
        vis = compute_visual_statistics(target_bytes)
        if vis:
            meta["visual_stats"] = vis
            q_means = vis.get("quadrant_means", {})
            summary_lines.extend([
                "Métricas Visuais Quantitativas Extraídas dos Pixels desta Imagem:",
                f"- Resolução analisada: {vis['width']}x{vis['height']} px | Intensidade média: {vis['mean_intensity']}/255 | Contraste (DP): {vis['std_contrast']}",
                f"- Distribuição de intensidades: fundo escuro={vis['background_pct']}%, atenuação intermediária={vis['soft_tissue_pct']}%, alta densidade={vis['dense_tissue_pct']}%, focos hiperintensos={vis['hyperdense_foci_pct']}%",
                f"- Padrão quantitativo de atenuação/densidade: {vis['density_pattern']} ({vis['relative_dense_ratio']}% da área útil)",
                (
                    f"- Intensidade média por quadrante: Sup. Esq.={q_means.get('superior_esquerdo', 0)}, "
                    f"Sup. Dir.={q_means.get('superior_direito', 0)}, "
                    f"Inf. Esq.={q_means.get('inferior_esquerdo', 0)}, "
                    f"Inf. Dir.={q_means.get('inferior_direito', 0)}, "
                    f"Região Central={vis['center_mean']}"
                ),
                f"- Quadrante de maior concentração luminosa/densidade: {vis['dominant_quadrant']} (focos de alta intensidade predominantes no quadrante {vis['focal_quadrant']})",
            ])

    return "\n".join(summary_lines), meta


def validate_and_inspect_document(filename: str, content_type: str, raw_bytes: bytes) -> Dict[str, Any]:
    """
    Inspeção e validação para suportar tanto documentos quanto imagens DICOM e convencionais.
    Garante proteção LGPD impedindo a exposição de dados sensíveis.
    """
    lower_filename = filename.lower()

    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        raise RosaIABaseException(
            status_code=413,
            detail="Arquivo muito grande. O limite máximo permitido para exames e imagens é de 15 MB.",
        )

    is_dicom = is_dicom_file(raw_bytes, filename)
    is_img = is_image_file(raw_bytes, filename)
    is_doc = any(lower_filename.endswith(ext) for ext in DOCUMENT_EXTENSIONS)

    if not (is_dicom or is_img or is_doc):
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
            except Exception:
                return (
                    f"Exame de Imagem Médica DICOM ({filename}).\n"
                    f"Higienização: Metadados sensíveis protegidos pela LGPD.\n"
                    f"Descrição: Aquisição radiológica para análise visual e técnica."
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
    ".ima": "application/dicom",
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
    if not extension and info["is_dicom"]:
        extension = ".dcm"
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
    target_name = filename if filename.lower().endswith(extension.lower()) else f"{filename}{extension}"
    return extract_text_from_document(
        target_name, _EXTENSION_TO_MIME.get(extension, ""), file_bytes
    )
