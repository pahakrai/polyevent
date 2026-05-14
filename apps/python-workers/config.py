"""
Celery configuration for ML training tasks.

Forces execv spawning (not fork) to prevent CUDA driver deadlocks
and GPU memory corruption when training runs in a worker process.
"""

import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "ml_pipeline",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.worker_pool = "prefork"
os.environ["CELERY_FORCE_EXECV"] = "1"

celery_app.conf.worker_prefetch_multiplier = 1

celery_app.conf.task_track_started = True
celery_app.conf.task_acks_late = True
celery_app.conf.result_expires = 86400  # 24h
