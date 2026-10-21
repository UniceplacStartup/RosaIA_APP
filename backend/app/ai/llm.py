"""
Camada única de chamada ao LLM com timeout, retry exponencial, troca automática
para o modelo alternativo e alerta de monitoramento quando tudo falha.
"""
import asyncio
import logging
import time
from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple, Type

import httpx
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel

from app.ai import monitoring
from app.ai.client import get_genai_client
from app.core.config import settings

logger = logging.getLogger("rosaia.ai.llm")

# (papel, texto) — papel: "user" ou "model"
ChatTurn = Tuple[str, str]


class LLMUnavailableError(Exception):
    """Levantada quando nenhum modelo conseguiu responder dentro dos limites de retry/timeout."""


@dataclass
class LLMResult:
    text: str
    model: str
    prompt_tokens: Optional[int]
    completion_tokens: Optional[int]
    latency_ms: int
    attempts: int


def _status_code(exc: BaseException) -> Optional[int]:
    code = getattr(exc, "code", None)
    return code if isinstance(code, int) else None


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, (asyncio.TimeoutError, httpx.TimeoutException, httpx.TransportError)):
        return True
    code = _status_code(exc)
    return code in (408, 429, 500, 502, 503, 504)


def _is_model_unavailable(exc: BaseException) -> bool:
    return _status_code(exc) in (400, 403, 404) and isinstance(exc, genai_errors.APIError)


async def generate(
    system_instruction: str,
    turns: Sequence[ChatTurn],
    *,
    response_schema: Optional[Type[BaseModel]] = None,
    temperature: float = 0.4,
    purpose: str = "chat",
    max_retries: Optional[int] = None,
    alert: bool = True,
) -> LLMResult:
    """
    Gera texto (ou JSON estruturado, se `response_schema` for informado).
    Lança `LLMUnavailableError` após esgotar tentativas e modelos.
    `max_retries`/`alert` permitem que chamadas auxiliares falhem rápido e sem alarde.
    """
    retries = settings.GEMINI_MAX_RETRIES if max_retries is None else max_retries
    client = get_genai_client()
    if client is None:
        if alert:
            await monitoring.alert_ai_failure("sem_api_key", "GEMINI_API_KEY ausente ou inválida")
        raise LLMUnavailableError("GEMINI_API_KEY não configurada")

    contents: List[types.Content] = [
        types.Content(role=role, parts=[types.Part(text=text)]) for role, text in turns
    ]
    config_kwargs = dict(system_instruction=system_instruction, temperature=temperature)
    if response_schema is not None:
        config_kwargs.update(
            response_mime_type="application/json", response_schema=response_schema
        )
    config = types.GenerateContentConfig(**config_kwargs)

    models = [settings.GEMINI_MODEL]
    if settings.GEMINI_FALLBACK_MODEL and settings.GEMINI_FALLBACK_MODEL != settings.GEMINI_MODEL:
        models.append(settings.GEMINI_FALLBACK_MODEL)

    attempts = 0
    last_error: Optional[BaseException] = None
    started = time.perf_counter()

    for model in models:
        for attempt in range(retries + 1):
            attempts += 1
            monitoring.incr("llm_calls")
            try:
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=model, contents=contents, config=config
                    ),
                    timeout=settings.GEMINI_TIMEOUT_SECONDS,
                )
                text = (response.text or "").strip()
                if not text:
                    raise ValueError("Resposta vazia do modelo")
                usage = response.usage_metadata
                return LLMResult(
                    text=text,
                    model=model,
                    prompt_tokens=getattr(usage, "prompt_token_count", None),
                    completion_tokens=getattr(usage, "candidates_token_count", None),
                    latency_ms=int((time.perf_counter() - started) * 1000),
                    attempts=attempts,
                )
            except Exception as exc:  # noqa: BLE001 — classificamos abaixo
                last_error = exc
                monitoring.incr("llm_failures")
                logger.warning(
                    "Falha Gemini (%s, modelo=%s, tentativa=%d): %s", purpose, model, attempt + 1, exc
                )
                if _is_model_unavailable(exc):
                    break  # tenta o próximo modelo imediatamente
                if not _is_retryable(exc) and not isinstance(exc, ValueError):
                    break
                if attempt < retries:
                    await asyncio.sleep(min(2 ** attempt, 8))

    detail = f"{purpose}: {type(last_error).__name__}: {last_error}"
    if alert:
        await monitoring.alert_ai_failure("gemini_indisponivel", detail)
    raise LLMUnavailableError(detail) from last_error
