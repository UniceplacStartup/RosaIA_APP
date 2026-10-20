from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.chat import router as chat_router
from app.api.v1.endpoints.upload import router as upload_router
from app.api.v1.endpoints.triage import router as triage_router
from app.api.v1.endpoints.reminders import router as reminders_router
from app.api.v1.endpoints.profile import router as profile_router

api_router = APIRouter()

# Rotas de monitoramento e prontidão
api_router.include_router(health_router)

# Rotas de negócio e inteligência
api_router.include_router(auth_router)
api_router.include_router(chat_router)
api_router.include_router(upload_router)
api_router.include_router(triage_router)
api_router.include_router(reminders_router)
api_router.include_router(profile_router)
