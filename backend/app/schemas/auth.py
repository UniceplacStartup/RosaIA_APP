import re
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import validate_cpf_modulo_11


class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=5, max_length=150, description="Nome e sobrenome completos")
    email: EmailStr = Field(..., description="E-mail válido da usuária")
    cpf: str = Field(..., description="CPF válido para proteção LGPD")
    password: str = Field(..., min_length=8, max_length=128, description="Senha no padrão OWASP")
    confirm_password: Optional[str] = Field(default=None, description="Confirmação da senha")
    accepted_terms: bool = Field(default=True, description="Aceite explícito dos Termos de Uso e LGPD")

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        clean = " ".join(v.strip().split())
        if len(clean.split(" ")) < 2 or len(clean) < 5:
            raise ValueError("Por favor, informe pelo menos seu nome e sobrenome (ex: Maria da Silva).")
        return clean

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, v: str) -> str:
        if not validate_cpf_modulo_11(v):
            raise ValueError("O CPF informado não passou no cálculo oficial dos dígitos verificadores (Módulo 11).")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_owasp(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("A senha deve ter no mínimo 8 caracteres.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("A senha deve conter pelo menos uma letra maiúscula.")
        if not re.search(r"[a-z]", v):
            raise ValueError("A senha deve conter pelo menos uma letra minúscula.")
        if not re.search(r"[0-9]", v):
            raise ValueError("A senha deve conter pelo menos um número.")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("A senha deve conter pelo menos um caractere especial.")
        return v


class UserLoginRequest(BaseModel):
    identifier: Optional[str] = Field(default=None, description="E-mail ou CPF")
    email: Optional[EmailStr] = Field(default=None, description="E-mail cadastrado")
    password: str = Field(..., min_length=1, description="Senha de acesso")

    def get_login_identifier(self) -> str:
        if self.identifier and self.identifier.strip():
            return self.identifier.strip()
        if self.email and self.email.strip():
            return self.email.strip()
        raise ValueError("É necessário informar o e-mail ou o CPF para efetuar o login.")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


UserAuthResponse = TokenResponse


class PasswordResetRequest(BaseModel):
    email: Optional[EmailStr] = None
    identifier: Optional[str] = None

    def get_identifier(self) -> str:
        if self.identifier:
            return self.identifier.strip()
        if self.email:
            return self.email.strip()
        return "usuario_nao_informado"


class PasswordResetResponse(BaseModel):
    message: str
    anti_enumeration_active: bool = True
