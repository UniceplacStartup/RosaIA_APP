import os
import sys
import asyncio
import logging
import re
from pathlib import Path
from typing import List, Dict, Any

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
    category = cat_match.group(1).strip() if cat_match else "Saúde e Prevenção"
    content = content_match.group(1).strip() if content_match else text.strip()

    return {
        "title": title,
        "institution": inst,
        "category": category,
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
                # Se o parágrafo for maior que max_chars, particiona com sobreposição
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

async def ingest_all_knowledge_chunks():
    """
    Processa todos os artigos, gera os embeddings e persiste no PostgreSQL pgvector.
    """
    logger.info("Iniciando ingestão da base de conhecimento científico RosaIA...")
    if not CHUNKS_DIR.exists():
        logger.error("Diretório de chunks não encontrado: %s", CHUNKS_DIR)
        return

    txt_files = list(CHUNKS_DIR.glob("*.txt"))
    logger.info("Encontrados %d arquivos de base científica em %s", len(txt_files), CHUNKS_DIR)

    async with AsyncSessionLocal() as session:
        for file_path in txt_files:
            parsed = parse_chunk_file(file_path)
            chunks = split_text_into_chunks(parsed["content"])
            logger.info("Processando '%s' (%d fragmentos)...", parsed["title"], len(chunks))

            for idx, chunk_text in enumerate(chunks, 1):
                chunk_title = f"{parsed['title']} (Parte {idx})" if len(chunks) > 1 else parsed["title"]
                
                # Gera embedding via Gemini text-embedding-004
                embedding_vector = await generate_text_embedding(f"{chunk_title}\n{chunk_text}")
                
                record = KnowledgeBaseChunk(
                    title=chunk_title,
                    source_institution=parsed["institution"],
                    reference_url=None,
                    topic_category=parsed["category"],
                    content_text=chunk_text,
                    embedding=embedding_vector
                )
                session.add(record)

        await session.commit()
        logger.info("Ingestão concluída com sucesso! Todos os fragmentos e vetores foram gravados.")

if __name__ == "__main__":
    asyncio.run(ingest_all_knowledge_chunks())
