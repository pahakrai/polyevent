# syntax=docker/dockerfile:1
# ── Stage 1: build wheels (needs gcc/g++ for compiled packages) ────────
FROM python:3.12-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY apps/python-workers/requirements.txt .

RUN --mount=type=cache,target=/root/.cache/pip,id=pip \
    pip wheel --no-cache-dir -r requirements.txt -w /wheels

# ── Stage 2: slim runtime (no build tools) ─────────────────────────────
FROM python:3.12-slim
WORKDIR /app

COPY --from=builder /wheels /wheels

RUN --mount=type=cache,target=/root/.cache/pip,id=pip \
    pip install --no-cache-dir /wheels/* && \
    rm -rf /wheels

COPY apps/python-workers/ .

RUN useradd -m -u 1000 worker
USER worker

CMD ["python", "-m", "ml-training.data_pipeline"]
