from typing import List, Optional

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.logging import logger

_client: Optional[genai.Client] = None


def get_genai_client() -> Optional[genai.Client]:
    """
    Retorna o cliente oficial do Google Gen AI SDK (`google-genai`) ou None quando
    a chave não está configurada (ou ainda é o texto de exemplo do .env.example).
    """
    global _client
    if not is_gemini_configured():
        return None
    if _client is None:
        try:
            _client = genai.Client(
                api_key=settings.GEMINI_API_KEY,
                http_options=types.HttpOptions(timeout=int(settings.GEMINI_TIMEOUT_SECONDS * 1000)),
            )
            logger.info("Google Gen AI configurado com sucesso (modelo: %s).", settings.GEMINI_MODEL)
        except Exception as e:
            logger.error("Falha ao configurar Google Gen AI: %s", e)
            return None
    return _client


def is_gemini_configured() -> bool:
    key = (settings.GEMINI_API_KEY or "").strip()
    return bool(key) and not key.lower().startswith(("sua_chave", "aizasy_suachave"))


async def generate_text_embedding(
    text: str, task_type: str = "RETRIEVAL_QUERY"
) -> Optional[List[float]]:
    """
    Gera o vetor de embedding de 768 dimensões (gemini-embedding-001 com
    output_dimensionality=768, compatível com a coluna pgvector).
    Use task_type="RETRIEVAL_DOCUMENT" ao indexar documentos da base de conhecimento.
    """
    client = get_genai_client()
    if client is None:
        return None
    try:
        result = await client.aio.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=settings.EMBEDDING_DIMENSION,
            ),
        )
        return list(result.embeddings[0].values)
    except Exception as e:
        logger.warning("Erro ao gerar embedding via Gemini: %s", e)
        return None
