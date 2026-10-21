"""
Monitoramento da IA: contadores em memória e alerta opcional via webhook
quando o Gemini falha e a usuária recebe uma resposta de contingência.
"""
import logging
import time
from typing import Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("rosaia.ai.monitoring")

_counters: Dict[str, int] = {
    "llm_calls": 0,
    "llm_failures": 0,
    "fallback_responses": 0,
    "alerts_sent": 0,
}
_last_alert_at: Dict[str, float] = {}


def incr(name: str, amount: int = 1) -> None:
    _counters[name] = _counters.get(name, 0) + amount


def snapshot() -> Dict[str, int]:
    return dict(_counters)


async def alert_ai_failure(kind: str, detail: str) -> None:
    """
    Registra erro crítico (ERROR no log, visível no Render) e, se configurado,
    notifica a equipe via webhook. Há cooldown por tipo de falha para evitar spam.
    """
    logger.error("ALERTA_IA | tipo=%s | detalhe=%s", kind, detail[:300])

    webhook: Optional[str] = (settings.ALERT_WEBHOOK_URL or "").strip()
    if not webhook:
        return

    now = time.monotonic()
    if now - _last_alert_at.get(kind, 0.0) < settings.ALERT_COOLDOWN_SECONDS:
        return
    _last_alert_at[kind] = now

    message = f"🚨 RosaIA — falha de IA ({kind}): {detail[:300]}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            # `text` (Slack/Teams) e `content` (Discord) cobrem os webhooks mais comuns
            await http.post(webhook, json={"text": message, "content": message})
        incr("alerts_sent")
    except Exception as exc:  # o alerta nunca pode derrubar o atendimento
        logger.warning("Falha ao enviar alerta de IA: %s", exc)
