import pytest

from app.core.security import (
    generate_recovery_code,
    hash_recovery_code,
    normalize_recovery_code,
    verify_recovery_code,
)
from app.schemas.auth import PasswordResetWithCodeRequest


def test_generate_recovery_code_format_and_entropy():
    codes = {generate_recovery_code() for _ in range(50)}
    assert len(codes) == 50
    for code in codes:
        parts = code.split("-")
        assert len(parts) == 4
        assert all(len(p) == 4 for p in parts)
        # Não usa caracteres ambíguos (0, O, 1, I)
        for ch in code.replace("-", ""):
            assert ch not in {"0", "O", "1", "I"}


def test_recovery_code_hash_and_verify_tolerant_formatting():
    code = generate_recovery_code()
    hashed = hash_recovery_code(code)

    assert hashed != code
    assert verify_recovery_code(code, hashed) is True
    assert verify_recovery_code(code.lower(), hashed) is True
    assert verify_recovery_code(code.replace("-", ""), hashed) is True
    assert verify_recovery_code(f"  {code.lower().replace('-', ' ')}  ", hashed) is True
    assert verify_recovery_code("XXXX-XXXX-XXXX-XXXX", hashed) is False
    assert verify_recovery_code("", hashed) is False
    assert normalize_recovery_code("ab12-cd34") == "AB12CD34"


def test_password_reset_schema_enforces_owasp_rules():
    valid = PasswordResetWithCodeRequest(
        identifier="maria@exemplo.com",
        recovery_code="K7M9-P2Q4-R8T5-W3X6",
        new_password="NovaSenha@2026",
        confirm_password="NovaSenha@2026",
    )
    assert valid.identifier == "maria@exemplo.com"

    with pytest.raises(ValueError):
        PasswordResetWithCodeRequest(
            identifier="maria@exemplo.com",
            recovery_code="K7M9-P2Q4-R8T5-W3X6",
            new_password="fraca",
        )
