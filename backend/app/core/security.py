import base64
import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Contexto de senha com suporte a Argon2id e BCrypt (custo >= 12)
pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated="auto",
    argon2__memory_cost=65536,
    argon2__time_cost=3,
    argon2__parallelism=4,
    bcrypt__rounds=12,
)

# Inicialização da suíte de criptografia simétrica para CPF
def _get_cipher_suite() -> Fernet:
    key_bytes = settings.CPF_AES_KEY.encode()
    # Se não for uma chave válida de Fernet (32 bytes em urlsafe base64), deriva uma chave determinística
    try:
        return Fernet(key_bytes)
    except Exception:
        derived = base64.urlsafe_b64encode(hashlib.sha256(key_bytes).digest())
        return Fernet(derived)


_cipher_suite = _get_cipher_suite()


def clean_cpf_digits(cpf: str) -> str:
    """Extrai apenas os dígitos numéricos do CPF."""
    return re.sub(r"\D", "", cpf or "")


def validate_cpf_modulo_11(cpf: str) -> bool:
    """
    Validação matemática oficial do CPF brasileiro via algoritmo Módulo 11.
    Rejeita CPFs com menos de 11 dígitos e sequências de dígitos repetidos (ex: 111.111.111-11).
    """
    digits = clean_cpf_digits(cpf)
    if len(digits) != 11:
        return False
    if digits == digits[0] * 11:
        return False

    int_digits = [int(d) for d in digits]

    # Validação do primeiro dígito verificador
    sum_1 = sum(int_digits[i] * (10 - i) for i in range(9))
    check_1 = ((sum_1 * 10) % 11) % 10
    if check_1 != int_digits[9]:
        return False

    # Validação do segundo dígito verificador
    sum_2 = sum(int_digits[i] * (11 - i) for i in range(10))
    check_2 = ((sum_2 * 10) % 11) % 10
    if check_2 != int_digits[10]:
        return False

    return True


def compute_cpf_blind_index(cpf: str) -> str:
    """
    Gera o Blind Index (HMAC-SHA256) do CPF com salt do servidor (LGPD Art. 13 & OWASP A02).
    Permite consultas exatas de unicidade (UNIQUE no Postgres) sem expor o CPF em texto puro.
    """
    digits = clean_cpf_digits(cpf)
    salt_bytes = settings.BLIND_INDEX_SALT.encode("utf-8")
    return hmac.new(salt_bytes, digits.encode("utf-8"), hashlib.sha256).hexdigest()


def encrypt_cpf(cpf: str) -> bytes:
    """Criptografa o CPF com chave simétrica AES (Fernet/AES-256) para armazenamento seguro."""
    digits = clean_cpf_digits(cpf)
    return _cipher_suite.encrypt(digits.encode("utf-8"))


def decrypt_cpf(encrypted: bytes) -> str:
    """Descriptografa o CPF para operações internas autorizadas."""
    try:
        decrypted = _cipher_suite.decrypt(encrypted)
        return decrypted.decode("utf-8")
    except InvalidToken:
        return ""


def mask_cpf(cpf: str) -> str:
    """
    Aplica máscara de proteção LGPD: ***.xxx.xxx-**
    Preserva apenas os 6 dígitos centrais se o CPF for válido.
    """
    digits = clean_cpf_digits(cpf)
    if len(digits) != 11:
        return "***.***.***-**"
    return f"***.{digits[3:6]}.{digits[6:9]}-**"


def hash_password(password: str) -> str:
    """Gera hash resistente a ataques de força bruta com Argon2id."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha em texto puro confere com o hash armazenado."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Gera token JWT assinado com claims de usuário e expiração."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodifica e valida assinatura e expiração do JWT."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def hash_ip(ip_address: Optional[str]) -> str:
    """Gera hash SHA-256 do endereço IP para auditoria OWASP sem armazenar PII (LGPD)."""
    clean_ip = (ip_address or "unknown").strip().encode("utf-8")
    return hashlib.sha256(clean_ip).hexdigest()
