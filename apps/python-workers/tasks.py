"""
Celery task wrapping the ML training pipeline.

Runs in a strictly spawned background process (not forked) so GPU
training never interferes with the inference API process.
"""

import logging
import os
import sys
from config import celery_app

logger = logging.getLogger("celery-training")


@celery_app.task(bind=True)
def execute_training(self, mode: str = "incremental", window_days: int = 7):
    """
    Execute the full ETLT pipeline in an isolated worker process.

    Args:
        mode: "full" or "incremental"
        window_days: Data window for incremental mode

    Returns:
        dict with status and summary metrics
    """
    logger.info(
        "Worker PID=%s starting %s training (window=%d days)",
        os.getpid(), mode, window_days,
    )

    self.update_state(state="STARTED", meta={"phase": "initializing", "mode": mode})

    sys.path.insert(
        0,
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml-training"),
    )
    from data_pipeline import DataPipeline

    pipeline = DataPipeline(
        mode=mode,
        window_days=window_days,
        feature_store_url=os.getenv("FEATURE_STORE_URL", "redis://localhost:6379"),
        output_path=os.getenv("TRAINING_DATA_PATH", "/data/training"),
        export_catalog=os.getenv("EXPORT_EVENT_CATALOG", "1") == "1",
        source_db_url=os.getenv("SOURCE_DATABASE_URL", ""),
    )

    self.update_state(state="IN_PROGRESS", meta={"phase": "extract"})
    pipeline.run()

    return {
        "status": "complete",
        "mode": mode,
        "window_days": window_days,
    }
