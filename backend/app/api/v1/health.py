from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db

router = APIRouter(tags=["Health & Status"])

@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """
    Liveness probe simples para monitoramento do Render/Kubernetes.
    """
    return {
        "status": "online",
        "app": "RosaIA Backend API",
        "institution": "Centro Universitário UNICEPLAC",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/health/readiness", status_code=status.HTTP_200_OK)
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """
    Readiness probe que verifica conectividade com o banco de dados PostgreSQL e extensões.
    """
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"unhealthy: {str(exc)}"

    return {
        "status": "ready" if db_status == "connected" else "degraded",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
