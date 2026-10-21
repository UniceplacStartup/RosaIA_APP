import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import setup_logging, log_security_event
from app.core.security import hash_ip
from app.core.exceptions import (
    RosaIABaseException,
    LGPDImageBlockedException,
    AuthenticationFailedException,
    AccountLockedException,
    CPFInvalidException
)
from app.api.v1.router import api_router

# Configura o sistema de log estruturado
setup_logging()
logger = logging.getLogger("rosaia.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gerencia o ciclo de vida da aplicação FastAPI.
    """
    logger.info("Iniciando RosaIA Backend (Centro Universitário UNICEPLAC)...")
    logger.info("Ambiente: %s | Host: %s", settings.ENVIRONMENT, settings.PROJECT_NAME)

    # Ingestão científica automática e idempotente em segundo plano
    if getattr(settings, "AUTO_INGEST_KNOWLEDGE_BASE", True):
        import asyncio
        from app.knowledge_base.ingest_knowledge import ingest_all_knowledge_chunks
        asyncio.create_task(ingest_all_knowledge_chunks())

    yield
    logger.info("Finalizando conexões e encerrando RosaIA Backend com segurança.")

# Inicializa o FastAPI com metadados acadêmicos e institucionais
app = FastAPI(
    title=f"{settings.PROJECT_NAME} API",
    description=(
        "Backend de Inteligência Artificial para Acolhimento Psicológico, Educação Preventiva em Saúde Mamária "
        "e Triagem Inteligente. Projeto de Extensão e Pesquisa do Centro Universitário UNICEPLAC (Gama/DF), "
        "premiado no Congresso Nacional de Radiologia."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Middleware de Segurança e Headers HTTP recomendados pela OWASP
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000

        # Headers de endurecimento de segurança
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Middleware de CORS para permitir comunicação segura com o frontend no Vercel e localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time-Ms"]
)

# Exception Handlers Customizados para LGPD e Regras de Negócio
@app.exception_handler(LGPDImageBlockedException)
async def lgpd_image_blocked_handler(request: Request, exc: LGPDImageBlockedException):
    client_ip = request.client.host if request.client else "0.0.0.0"
    log_security_event(
        event_type="LGPD_IMAGE_UPLOAD_BLOCKED",
        ip_hash=hash_ip(client_ip),
        details={"path": request.url.path, "error": exc.detail}
    )
    return JSONResponse(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        content={
            "error": "LGPD_IMAGE_PROHIBITED",
            "message": exc.detail,
            "legal_basis": "Lei Geral de Proteção de Dados (Lei 13.709/2018) - Princípio da Minimização e Tutela da Intimidade"
        }
    )

@app.exception_handler(AuthenticationFailedException)
async def auth_failed_handler(request: Request, exc: AuthenticationFailedException):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"error": "AUTH_FAILED", "message": exc.detail},
        headers={"WWW-Authenticate": "Bearer"}
    )

@app.exception_handler(AccountLockedException)
async def account_locked_handler(request: Request, exc: AccountLockedException):
    return JSONResponse(
        status_code=status.HTTP_423_LOCKED,
        content={"error": "ACCOUNT_LOCKED", "message": exc.detail}
    )

@app.exception_handler(CPFInvalidException)
async def cpf_invalid_handler(request: Request, exc: CPFInvalidException):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "INVALID_CPF", "message": exc.detail}
    )

@app.exception_handler(RosaIABaseException)
async def general_business_exception_handler(request: Request, exc: RosaIABaseException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "BUSINESS_RULE_VIOLATION", "message": exc.detail},
        headers=exc.headers,
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = " -> ".join([str(loc) for loc in err["loc"]])
        errors.append({"field": field, "msg": err["msg"]})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "VALIDATION_ERROR",
            "message": "Parâmetros inválidos na requisição.",
            "details": errors
        }
    )

# Inclusão do roteador principal da API
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Apresentação"])
async def root():
    """
    Ponto de entrada institucional da API.
    """
    return {
        "project": settings.PROJECT_NAME,
        "institution": "Centro Universitário UNICEPLAC (Gama/Brasília - DF)",
        "award": "Premiação de Excelência no Congresso Nacional de Radiologia",
        "description": "Assistente Virtual Doutora Rosa - Acolhimento e Prevenção do Câncer de Mama",
        "version": "1.0.0",
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        },
        "api_v1": settings.API_V1_STR
    }
