# ==============================================================================
# Dockerfile Multi-Stage para Produção — RosaIA APP Backend (Python 3.11-slim)
# ==============================================================================
FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ==============================================================================
# Runner Image
# ==============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/home/rosaia/.local/bin:$PATH" \
    PORT=8000

# Dependências de runtime do sistema (incluindo libmagic para Magic Bytes)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cria usuário não-root (princípio do menor privilégio OWASP)
RUN useradd -u 1001 -m rosaia

COPY --from=builder /root/.local /home/rosaia/.local
COPY --chown=rosaia:rosaia . /app

USER rosaia

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 2"]
