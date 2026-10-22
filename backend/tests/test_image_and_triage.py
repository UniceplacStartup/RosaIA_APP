import io
import pytest
from PIL import Image
from app.services.file_validator import (
    validate_and_inspect_document,
    extract_text_from_document,
    sanitize_conventional_image,
)
from app.ai.prompts import clean_rosa_text
from app.schemas.triage import TriageInput
from app.services.triage_service import build_detailed_empathetic_triage_guidance


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
    # Cria uma imagem JPEG válida em memória
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
    # Simula bytes com o preâmbulo DICOM padrão (128 bytes + 'DICM')
    dicom_bytes = b"\x00" * 128 + b"DICM" + b"\x00" * 50
    inspection = validate_and_inspect_document("exame_paciente.dcm", "application/dicom", dicom_bytes)
    assert inspection["is_dicom"] is True
    assert inspection["file_kind"] == "dicom"

    text = extract_text_from_document("exame_paciente.dcm", "application/dicom", dicom_bytes)
    assert "DICOM" in text
    assert "*" not in text


def test_triage_guidance_is_empathetic_and_clean():
    triage_data = TriageInput(
        age_range="50_69",
        has_family_history=True,
        reported_signs=["Caroço ou nódulo fixo", "Dor mamária"],
    )
    guidance = build_detailed_empathetic_triage_guidance(triage_data)

    # Verifica que não possui asteriscos ou hashtags
    assert "*" not in guidance
    assert "#" not in guidance

    # Verifica o tom empático e dados científicos
    assert "80%" in guidance
    assert "95%" in guidance
    assert "acolho" in guidance.lower() or "carinho" in guidance.lower()
    assert "50 a 69 anos" in guidance
