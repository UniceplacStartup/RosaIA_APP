from typing import List, Union
# pyrefly: ignore[missing-import]
from pydantic import Field, field_validator
# pyrefly: ignore[missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "RosaIA APP — Backend API (UNICEPLAC)"
    API_V1_STR: str = "/api/v1"

    # PostgreSQL assíncrono (asyncpg) — Neon.tech, Supabase ou local
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/rosaia",
        description="URL assíncrona do PostgreSQL. Ex: postgresql+asyncpg://user:pass@host/db?ssl=require",
    )

    # Autenticação JWT
    SECRET_KEY: str = Field(
        default="rosaia-uniceplac-super-secret-jwt-key-change-in-production-2026",
        description="Chave secreta para assinatura dos tokens JWT",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 dias de persistência segura da sessão

    # Segurança Criptográfica & LGPD de CPF
    BLIND_INDEX_SALT: str = Field(
        default="salt-secreto-blind-index-hmac-sha256-cpf-uniceplac",
        description="Salt secreto do servidor para o cálculo determinístico de cpf_hash",
    )
    CPF_AES_KEY: str = Field(
        default="TkxKUTdGOUlaMkV0WlU1UWhrZ3VRV3R6WG95bVh2bTg=",
        description="Chave de 32 bytes em Base64 para cifragem simétrica (AES-256-GCM / Fernet)",
    )

    # Google Gemini AI Studio
    GEMINI_API_KEY: str = Field(
        default="",
        description="Chave de API do Google AI Studio (Gemini 2.5 Flash)",
    )
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"
    EMBEDDING_DIMENSION: int = 768

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://*.vercel.app",
    ]

    # Política de Proteção contra Força Bruta (OWASP A07)
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15

    # Limite de Upload de Laudos em Texto/PDF (Sem Imagens)
    MAX_DOCUMENT_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://*.vercel.app",
        ]


settings = Settings()
