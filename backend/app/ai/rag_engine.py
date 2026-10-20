from typing import List, Dict, Any, Optional
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.ai.client import generate_text_embedding
from app.db.models.knowledge import KnowledgeBaseChunk

logger = logging.getLogger("rosaia.ai.rag_engine")

async def retrieve_relevant_medical_context(
    query: str,
    db: AsyncSession,
    top_k: int = 3,
    similarity_threshold: float = 0.55
) -> List[Dict[str, Any]]:
    """
    Recupera os fragmentos científicos mais relevantes da base de conhecimento
    utilizando similaridade vetorial por cosseno (pgvector 768-dim) ou fallback.
    """
    try:
        query_vector = await generate_text_embedding(query)
    except Exception as exc:
        logger.warning("Falha ao gerar embedding para consulta RAG: %s", exc)
        query_vector = None

    if query_vector is not None:
        try:
            # Similaridade por cosseno com pgvector
            distance_expr = KnowledgeBaseChunk.embedding.cosine_distance(query_vector)
            stmt = (
                select(
                    KnowledgeBaseChunk.title,
                    KnowledgeBaseChunk.source_institution,
                    KnowledgeBaseChunk.topic_category,
                    KnowledgeBaseChunk.content_text,
                    (1 - distance_expr).label("similarity")
                )
                .where(KnowledgeBaseChunk.embedding.isnot(None))
                .order_by(distance_expr.asc())
                .limit(top_k)
            )
            result = await db.execute(stmt)
            rows = result.all()
            
            contexts = []
            for row in rows:
                if row.similarity >= similarity_threshold:
                    contexts.append({
                        "title": row.title,
                        "source": row.source_institution,
                        "category": row.topic_category,
                        "content": row.content_text,
                        "similarity": float(row.similarity)
                    })
            if contexts:
                return contexts
        except Exception as db_err:
            logger.warning("Falha na consulta vetorial pgvector: %s", db_err)

    # Fallback contextual médico fixo baseado nas diretrizes do UNICEPLAC e INCA
    return [
        {
            "title": "Diretrizes de Acolhimento e Rastreamento de Câncer de Mama",
            "source": "UNICEPLAC / INCA",
            "category": "Prevenção e Acolhimento",
            "content": (
                "Aproximadamente 80% a 90% das alterações palpáveis na mama (nódulos) "
                "são lesões benignas (cistos, fibroadenomas). Quando detectado precocemente, "
                "o câncer de mama apresenta mais de 95% de probabilidade de cura definitiva. "
                "O acolhimento empático e o diálogo humanizado reduzem a ansiedade e estimulam "
                "a adesão aos exames preventivos de rotina."
            ),
            "similarity": 1.0
        }
    ]

def format_rag_context_for_prompt(contexts: List[Dict[str, Any]]) -> str:
    """
    Formata os fragmentos recuperados para injeção no prompt do Gemini.
    """
    if not contexts:
        return ""
    
    formatted = ["=== EVIDÊNCIAS E BASE CIENTÍFICA INSTITUCIONAL (RAG) ==="]
    for idx, ctx in enumerate(contexts, 1):
        formatted.append(
            f"[{idx}] {ctx.get('title')} ({ctx.get('source')} - {ctx.get('category')}):\n"
            f"{ctx.get('content')}\n"
        )
    formatted.append("========================================================\n")
    return "\n".join(formatted)
