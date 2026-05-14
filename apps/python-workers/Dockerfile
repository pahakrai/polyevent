# syntax=docker/dockerfile:1
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY apps/python-workers/requirements.txt .

RUN --mount=type=cache,target=/root/.cache/pip,id=pip \
    pip install --no-cache-dir -r requirements.txt

COPY apps/python-workers/ .

RUN useradd -m -u 1000 worker
USER worker

CMD ["python", "-m", "ml-training.data_pipeline"]
