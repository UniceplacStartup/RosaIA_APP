from typing import List, Optional
import google.generativeai as genai

from app.core.config import settings
from app.core.logging import logger

_is_configured = False


def get_genai_client():
    """Inicializa e configura o cliente oficial do Google Generative AI (Gemini)."""
    global _is_configured
    if not _is_configured and settings.GEMINI_API_KEY:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            _is_configured = True
            logger.info("Google Generative AI configurado com sucesso.")
        except Exception as e:
            logger.error(f"Falha ao configurar Google Generative AI: {e}")
    return genai


async def generate_text_embedding(text: str) -> Optional[List[float]]:
    """Gera o vetor de embedding de 768 dimensões usando text-embedding-004."""
    if not settings.GEMINI_API_KEY:
        return None
    try:
        client = get_genai_client()
        result = client.embed_content(
            model=f"models/{settings.GEMINI_EMBEDDING_MODEL}",
            content=text,
            task_type="retrieval_query",
        )
        return result.get("embedding")
    except Exception as e:
        logger.warning(f"Erro ao gerar embedding via Gemini: {e}")
        return None
