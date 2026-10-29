import array
import io
import pytest
from PIL import Image
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian

from app.services.file_validator import (
    validate_and_inspect_document,
    extract_text_from_document,
    sanitize_conventional_image,
    prepare_image_for_vision,
    extract_image_technical_context,
)
from app.ai.report_interpreter import build_specific_image_analysis_fallback
from app.ai.prompts import clean_rosa_text
from app.schemas.triage import TriageInput
from app.services.triage_service import build_detailed_empathetic_triage_guidance


def _make_dicom_bytes(
    *,
    modality: str,
    body_part: str,
    laterality: str,
    view_pos: str,
    rows: int,
    cols: int,
    quadrant_bias: str,
) -> bytes:
    fm = FileMetaDataset()
    fm.TransferSyntaxUID = ExplicitVRLittleEndian
    fm.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.1.2"
    fm.MediaStorageSOPInstanceUID = "1.2.3.4.5"
    ds = FileDataset("sample.dcm", {}, file_meta=fm, preamble=b"\0" * 128)
    ds.Modality = modality
    ds.BodyPartExamined = body_part
    ds.ImageLaterality = laterality
    ds.ViewPosition = view_pos
    ds.Rows = rows
    ds.Columns = cols
    ds.BitsAllocated = 16
    ds.BitsStored = 12
    ds.HighBit = 11
    ds.PixelRepresentation = 0
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"

    pixels = []
    for r in range(rows):
        for c in range(cols):
            if quadrant_bias == "top_left":
                val = 3500 if (r < rows // 2 and c < cols // 2) else 400
            else:
                val = 3800 if (r >= rows // 2 and c >= cols // 2) else 250
            pixels.append(val)

    ds.PixelData = array.array("H", pixels).tobytes()
    buf = io.BytesIO()
    ds.save_as(buf, write_like_original=False)
    return buf.getvalue()


def test_clean_rosa_text_removes_asterisks_and_hashtags():
    dirty_text = (
        "## Avaliação da Doutora Rosa\n\n"
        "Olá, **Maria**! Quero que fique *calma*. "
        "• **BI-RADS 2:** Resultado benigno.\n"
        "# Conclusão\n"
        "*(Aviso Médico: Educativo)*"
    )
    cleaned = clean_rosa_text(dirty_text)

    assert "*" not in cleaned
    assert "#" not in cleaned
    assert "Maria" in cleaned
    assert "BI-RADS 2:" in cleaned
    assert "Aviso Médico: Educativo" in cleaned


def test_conventional_image_support_and_sanitization():
    img = Image.new("RGB", (100, 100), color="pink")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    raw_bytes = buf.getvalue()

    inspection = validate_and_inspect_document("mamografia_exame.jpg", "image/jpeg", raw_bytes)
    assert inspection["is_image"] is True
    assert inspection["file_kind"] == "image"

    desc, meta = sanitize_conventional_image(raw_bytes, "mamografia_exame.jpg")
    assert meta["sanitized"] is True
    assert "100x100" in desc


def test_dicom_file_support():
    dicom_bytes = b"\x00" * 128 + b"DICM" + b"\x00" * 50
    inspection = validate_and_inspect_document("exame_paciente.dcm", "application/dicom", dicom_bytes)
    assert inspection["is_dicom"] is True
    assert inspection["file_kind"] == "dicom"

    text = extract_text_from_document("exame_paciente.dcm", "application/dicom", dicom_bytes)
    assert "DICOM" in text
    assert "*" not in text


def test_each_dicom_image_generates_unique_specific_analysis_without_birads_lecture():
    dcm1 = _make_dicom_bytes(
        modality="MG",
        body_part="BREAST",
        laterality="R",
        view_pos="MLO",
        rows=64,
        cols=64,
        quadrant_bias="top_left",
    )
    dcm2 = _make_dicom_bytes(
        modality="CT",
        body_part="CHEST",
        laterality="L",
        view_pos="AP",
        rows=80,
        cols=96,
        quadrant_bias="bottom_right",
    )

    vis1 = prepare_image_for_vision(dcm1, "mama_direita_mlo.dcm")
    vis2 = prepare_image_for_vision(dcm2, "torax_tc.dcm")
    assert vis1 is not None
    assert vis2 is not None

    ctx1, meta1 = extract_image_technical_context(dcm1, "mama_direita_mlo.dcm", vis1[0])
    ctx2, meta2 = extract_image_technical_context(dcm2, "torax_tc.dcm", vis2[0])

    analysis1 = build_specific_image_analysis_fallback("mama_direita_mlo.dcm", ctx1, meta1)
    analysis2 = build_specific_image_analysis_fallback("torax_tc.dcm", ctx2, meta2)

    assert analysis1.reply != analysis2.reply
    assert "Mamografia Digital" in analysis1.reply
    assert "Direita" in analysis1.reply
    assert "Médio-Lateral Oblíqua" in analysis1.reply
    assert "superior esquerdo" in analysis1.reply

    assert "Tomografia Computadorizada" in analysis2.reply
    assert "CHEST" in analysis2.reply
    assert "96x80" in analysis2.reply
    assert "inferior direito" in analysis2.reply

    # Garante que nenhuma análise de imagem despeja palestra genérica sobre BI-RADS
    assert "BI-RADS" not in analysis1.reply
    assert "BI-RADS" not in analysis2.reply


def test_triage_guidance_is_empathetic_and_clean():
    triage_data = TriageInput(
        age_range="50_69",
        has_family_history=True,
        reported_signs=["Caroço ou nódulo fixo", "Dor mamária"],
    )
    guidance = build_detailed_empathetic_triage_guidance(triage_data)

    assert "*" not in guidance
    assert "#" not in guidance
    assert "80%" in guidance
    assert "95%" in guidance
    assert "acolho" in guidance.lower() or "carinho" in guidance.lower()
    assert "50 a 69 anos" in guidance
