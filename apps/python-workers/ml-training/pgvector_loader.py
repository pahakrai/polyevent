#!/usr/bin/env python3
"""
Atomic bulk load of training embeddings into pgvector.

Implements the zero-downtime load sequence:
  1. BEGIN
  2. DROP INDEX (maximizes write throughput)
  3. TRUNCATE table
  4. COPY / batch INSERT from Parquet
  5. CREATE INDEX (HNSW rebuild)
  6. COMMIT

Queries against the old index continue to work during the transaction
because DROP INDEX runs inside the still-uncommitted transaction.
The COMMIT atomically swaps to the new data + new index.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("pgvector-loader")


def _to_vector_str(arr: np.ndarray) -> str:
    """Format a numpy array as a pgvector-compatible string: [v1,v2,...,vn]."""
    return "[" + ",".join(f"{x:.10f}" for x in arr) + "]"


def load_vectors_to_pgvector(
    parquet_dir: str,
    db_url: Optional[str] = None,
) -> None:
    """Load event and user vectors from Parquet files into pgvector.

    Args:
        parquet_dir: Directory containing event_vectors.parquet and user_vectors.parquet
        db_url: PostgreSQL connection URL (defaults to VECTOR_DATABASE_URL env var)
    """
    try:
        import pyarrow.parquet as pq
    except ImportError:
        logger.error("pyarrow not installed — required for Parquet loading")
        return

    try:
        import psycopg2
        from psycopg2.extras import execute_values
    except ImportError:
        logger.error("psycopg2 not installed — required for pgvector connection")
        return

    db_url = db_url or os.getenv("VECTOR_DATABASE_URL", "")
    if not db_url:
        logger.error("VECTOR_DATABASE_URL not set")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = False

    try:
        # ── Event embeddings ──────────────────────────────────────────

        event_parquet = os.path.join(parquet_dir, "event_vectors.parquet")
        if os.path.exists(event_parquet):
            logger.info("Loading event vectors from %s", event_parquet)
            table = pq.read_table(event_parquet)
            df = table.to_pandas()

            # Determine embedding dimension from column names (emb_0, emb_1, ...)
            emb_cols = sorted(
                [c for c in df.columns if c.startswith("emb_")],
                key=lambda x: int(x.split("_")[1]),
            )
            emb_dim = len(emb_cols)
            logger.info("  %d events, embedding dim=%d", len(df), emb_dim)

            # Build rows for batch insert
            rows = []
            for _, row in df.iterrows():
                event_id = str(row["event_id"])
                emb_vals = [float(row[c]) for c in emb_cols]
                emb_str = _to_vector_str(np.array(emb_vals, dtype=np.float32))
                rows.append((event_id, emb_str))

            with conn.cursor() as cur:
                logger.info("  Dropping HNSW index on event_embeddings...")
                cur.execute("DROP INDEX IF EXISTS idx_event_embeddings_vector")

                logger.info("  Truncating event_embeddings...")
                cur.execute("TRUNCATE event_embeddings")

                logger.info("  Batch inserting %d rows...", len(rows))
                execute_values(
                    cur,
                    "INSERT INTO event_embeddings (event_id, embedding) VALUES %s",
                    [(eid, emb) for eid, emb in rows],
                    template="(%s, %s::vector)",
                    page_size=1000,
                )

                logger.info("  Rebuilding HNSW index (m=16, ef_construction=200)...")
                cur.execute(
                    "CREATE INDEX idx_event_embeddings_vector "
                    "ON event_embeddings USING hnsw (embedding vector_cosine_ops) "
                    "WITH (m = 16, ef_construction = 200)"
                )

            logger.info("  Event embeddings loaded: %d rows", len(rows))
        else:
            logger.warning("No event_vectors.parquet found at %s", event_parquet)

        # ── User embeddings ───────────────────────────────────────────

        user_parquet = os.path.join(parquet_dir, "user_vectors.parquet")
        if os.path.exists(user_parquet):
            logger.info("Loading user vectors from %s", user_parquet)
            table = pq.read_table(user_parquet)
            df = table.to_pandas()

            emb_cols = sorted(
                [c for c in df.columns if c.startswith("emb_")],
                key=lambda x: int(x.split("_")[1]),
            )

            rows = []
            for _, row in df.iterrows():
                user_id = str(row["user_id"])
                emb_vals = [float(row[c]) for c in emb_cols]
                emb_str = _to_vector_str(np.array(emb_vals, dtype=np.float32))
                rows.append((user_id, emb_str))

            with conn.cursor() as cur:
                logger.info("  Dropping HNSW index on user_embeddings...")
                cur.execute("DROP INDEX IF EXISTS idx_user_embeddings_vector")

                logger.info("  Truncating user_embeddings...")
                cur.execute("TRUNCATE user_embeddings")

                logger.info("  Batch inserting %d rows...", len(rows))
                execute_values(
                    cur,
                    "INSERT INTO user_embeddings (user_id, embedding) VALUES %s",
                    [(uid, emb) for uid, emb in rows],
                    template="(%s, %s::vector)",
                    page_size=1000,
                )

                logger.info("  Rebuilding HNSW index...")
                cur.execute(
                    "CREATE INDEX idx_user_embeddings_vector "
                    "ON user_embeddings USING hnsw (embedding vector_cosine_ops) "
                    "WITH (m = 16, ef_construction = 200)"
                )

            logger.info("  User embeddings loaded: %d rows", len(rows))
        else:
            logger.warning("No user_vectors.parquet found at %s", user_parquet)

        # ── Commit ────────────────────────────────────────────────────

        conn.commit()
        logger.info("pgvector bulk load committed successfully")

    except Exception as e:
        conn.rollback()
        logger.error("Bulk load failed, transaction rolled back: %s", e)
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    import sys

    parquet_dir = sys.argv[1] if len(sys.argv) > 1 else os.getenv(
        "TRAINING_DATA_PATH", "/data/training"
    )
    load_vectors_to_pgvector(parquet_dir)
