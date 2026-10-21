import os
import sys
import asyncio
import logging
import re
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional

# Adiciona o diretório raiz do backend ao sys.path para execução autônoma
backend_root = Path(__file__).resolve().parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from sqlalchemy import select, delete
from app.db.session import AsyncSessionLocal
from app.db.models.knowledge import KnowledgeBaseChunk
from app.ai.client import generate_text_embedding

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("rosaia.ingest")

CHUNKS_DIR = Path(__file__).resolve().parent / "chunks"

def parse_chunk_file(file_path: Path) -> Dict[str, str]:
    """
    Extrai cabeçalhos estruturados e corpo do arquivo de conhecimento.
    """
    text = file_path.read_text(encoding="utf-8")
    
    title_match = re.search(r"^TÍTULO:\s*(.+)$", text, re.MULTILINE)
    authors_match = re.search(r"^AUTORES:\s*(.+)$", text, re.MULTILINE)
    inst_match = re.search(r"^INSTITUIÇÃO:\s*(.+)$", text, re.MULTILINE)
    cat_match = re.search(r"^CATEGORIA:\s*(.+)$", text, re.MULTILINE)
    content_match = re.search(r"CONTEÚDO CIENTÍFICO:\s*([\s\S]+)$", text)

    title = title_match.group(1).strip() if title_match else file_path.stem.replace("_", " ").title()
    inst = inst_match.group(1).strip() if inst_match else "Centro Universitário UNICEPLAC"
    raw_cat = (cat_match.group(1).strip() if cat_match else "Prevenção").lower()

    if any(k in raw_cat for k in ("birads", "bi-rads", "laudo", "radiologia")):
        valid_cat = "laudos_birads"
    elif any(k in raw_cat for k in ("sinal", "sintoma", "alerta")):
        valid_cat = "sinais_sintomas"
    elif any(k in raw_cat for k in ("apoio", "acolhimento", "psico", "emocional")):
        valid_cat = "apoio_psicologico"
    elif any(k in raw_cat for k in ("lgpd", "etica", "ética", "direito", "privacidade")):
        valid_cat = "direitos_paciente"
    elif any(k in raw_cat for k in ("tratamento", "cura", "esperanca", "esperança")):
        valid_cat = "tratamento_esperanca"
    else:
        valid_cat = "prevencao_rastreamento"

    content = content_match.group(1).strip() if content_match else text.strip()

    return {
        "title": title,
        "institution": inst,
        "category": valid_cat,
        "content": content
    }

def split_text_into_chunks(text: str, max_chars: int = 800, overlap: int = 150) -> List[str]:
    """
    Divide o texto em fragmentos contínuos com sobreposição para manter o contexto semântico.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current_chunk = ""

    for paragraph in paragraphs:
        if len(current_chunk) + len(paragraph) <= max_chars:
            current_chunk = f"{current_chunk}\n\n{paragraph}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
            if len(paragraph) > max_chars:
                start = 0
                while start < len(paragraph):
                    end = start + max_chars
                    chunks.append(paragraph[start:end])
                    start += (max_chars - overlap)
                current_chunk = ""
            else:
                current_chunk = paragraph

    if current_chunk:
        chunks.append(current_chunk)

    return chunks

def compute_chunk_hash(title: str, text: str) -> str:
    raw = f"{title.strip()}:::{text.strip()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()

async def ingest_all_knowledge_chunks(force: bool = False):
    """
    Processa todos os artigos, gera os embeddings e persiste no PostgreSQL pgvector.
    Idempotente: pula itens cujo hash já esteja no banco com embedding válido.
    """
    logger.info("Iniciando ingestão da base de conhecimento científico RosaIA...")
    if not CHUNKS_DIR.exists():
        logger.error("Diretório de chunks não encontrado: %s", CHUNKS_DIR)
        return

    txt_files = sorted(list(CHUNKS_DIR.glob("*.txt")))
    logger.info("Encontrados %d arquivos de base científica em %s", len(txt_files), CHUNKS_DIR)

    async with AsyncSessionLocal() as session:
        # Busca hashes existentes
        stmt = select(KnowledgeBaseChunk.content_hash, KnowledgeBaseChunk.embedding).where(
            KnowledgeBaseChunk.origin == "official"
        )
        res = await session.execute(stmt)
        existing_map = {row[0]: (row[1] is not None) for row in res.all() if row[0]}

        inserted_count = 0
        skipped_count = 0

        for file_path in txt_files:
            parsed = parse_chunk_file(file_path)
            chunks = split_text_into_chunks(parsed["content"])
            logger.info("Processando '%s' (%d fragmentos)...", parsed["title"], len(chunks))

            for idx, chunk_text in enumerate(chunks, 1):
                chunk_title = f"{parsed['title']} (Parte {idx})" if len(chunks) > 1 else parsed["title"]
                c_hash = compute_chunk_hash(chunk_title, chunk_text)

                if not force and existing_map.get(c_hash):
                    skipped_count += 1
                    continue

                # Gera embedding com a API oficial do Gemini
                embedding_vector = await generate_text_embedding(
                    f"{chunk_title}\n{chunk_text}",
                    task_type="RETRIEVAL_DOCUMENT"
                )

                # Se já existia registro mas precisava de embedding
                existing_rec = None
                if c_hash in existing_map:
                    stmt_rec = select(KnowledgeBaseChunk).where(KnowledgeBaseChunk.content_hash == c_hash)
                    r = await session.execute(stmt_rec)
                    existing_rec = r.scalar_one_or_none()

                if existing_rec:
                    existing_rec.embedding = embedding_vector
                    existing_rec.title = chunk_title
                    existing_rec.content_text = chunk_text
                    existing_rec.topic_category = parsed["category"]
                    existing_rec.source_institution = parsed["institution"]
                else:
                    record = KnowledgeBaseChunk(
                        title=chunk_title,
                        source_institution=parsed["institution"],
                        reference_url=None,
                        topic_category=parsed["category"],
                        content_text=chunk_text,
                        embedding=embedding_vector,
                        origin="official",
                        content_hash=c_hash,
                        is_active=True
                    )
                    session.add(record)

                inserted_count += 1
                # Pequena pausa para respeitar cotas de taxa de embed do Google AI Studio
                await asyncio.sleep(0.3)

        await session.commit()
        logger.info(
            "Ingestão concluída! Inseridos/atualizados: %d | Já existentes: %d",
            inserted_count,
            skipped_count
        )

if __name__ == "__main__":
    asyncio.run(ingest_all_knowledge_chunks())
