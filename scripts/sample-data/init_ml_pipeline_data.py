#!/usr/bin/env python3
"""
Initialize ML Pipeline Sample Data.

Populates Redis FeatureStore and pgvector with sample training data
so the recommendation and search ML pipelines have data to work with
immediately after setup.

Usage:
  python scripts/sample-data/init_ml_pipeline_data.py              # Initialize all
  python scripts/sample-data/init_ml_pipeline_data.py --redis-only # Redis only
  python scripts/sample-data/init_ml_pipeline_data.py --pgvector-only  # pgvector only
"""

import argparse
import hashlib
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import numpy as np

# ============================================================
# Configuration
# ============================================================

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
VECTOR_DB_URL = os.getenv(
    "VECTOR_DATABASE_URL",
    "postgresql://eventbooking:eventbooking123@localhost:5432/vector_db",
)

# Sample data IDs (must match sample-data-constants.ts)
USER_IDS = [f"user-{i:03d}" for i in range(1, 26)]
EVENT_IDS = [f"event-{i:03d}" for i in range(1, 41)]
CATEGORIES = ["MUSIC", "ART", "SPORTS", "ACTIVITIES", "OTHER"]

EMBEDDING_DIM = 64


def generate_embedding(seed: str) -> list[float]:
    """Generate a deterministic embedding vector from a seed string."""
    hash_bytes = hashlib.sha256(seed.encode()).digest()
    # Use hash bytes to seed numpy RNG for a deterministic but unique vector
    seed_int = int.from_bytes(hash_bytes[:8], "big")
    rng = np.random.RandomState(seed_int)
    vec = rng.randn(EMBEDDING_DIM).astype(np.float32)
    vec = vec / np.linalg.norm(vec)  # L2 normalize
    return vec.tolist()


def init_redis_feature_store():
    """Populate Redis FeatureStore with sample user and event feature vectors."""
    try:
        import redis
    except ImportError:
        print("[WARN] redis package not installed. Skipping Redis init.")
        print("       Install with: pip install redis")
        return False

    print("\n--- Initializing Redis FeatureStore ---")

    try:
        r = redis.from_url(REDIS_URL, decode_responses=False)
        r.ping()
        print(f"  Connected to Redis at {REDIS_URL}")
    except Exception as e:
        print(f"  [WARN] Cannot connect to Redis: {e}")
        print("  Skipping Redis initialization.")
        return False

    # Store user feature vectors (139-dim mock features)
    print("  Storing user feature vectors...")
    for user_id in USER_IDS:
        user_vec = generate_embedding(f"user_features:{user_id}:v1")
        # Simulate the 139-dim feature vector from the 7 feature engineers
        full_features = np.random.RandomState(hash(user_id) % 2**32).randn(139).astype(np.float32)
        r.hset(f"user_features:{user_id}", mapping={
            "vector": full_features.tobytes(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        r.expire(f"user_features:{user_id}", 86400 * 7)  # 7-day TTL

    # Store event feature vectors
    print("  Storing event feature vectors...")
    for event_id in EVENT_IDS:
        event_vec = generate_embedding(f"event_features:{event_id}:v1")
        full_features = np.random.RandomState(hash(event_id) % 2**32).randn(139).astype(np.float32)
        r.hset(f"event_features:{event_id}", mapping={
            "vector": full_features.tobytes(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        r.expire(f"event_features:{event_id}", 86400 * 7)

    # Store inference vectors for users (session-based)
    print("  Storing inference vectors...")
    for user_id in USER_IDS:
        vec = generate_embedding(f"inference:{user_id}:v1")
        r.set(f"inference_vector:{user_id}", json.dumps(vec).encode(), ex=3600)

    # Store recent event clicks for session tracking
    print("  Storing recent event click data...")
    for user_id in USER_IDS:
        recent_events = np.random.choice(EVENT_IDS, size=min(10, len(EVENT_IDS)), replace=False)
        for event_id in recent_events:
            r.lpush(f"recent_clicks:{user_id}", event_id)
        r.ltrim(f"recent_clicks:{user_id}", 0, 19)  # Keep last 20
        r.expire(f"recent_clicks:{user_id}", 86400)

    print(f"  Redis FeatureStore initialized successfully!")
    print(f"    • {len(USER_IDS)} user feature vectors")
    print(f"    • {len(EVENT_IDS)} event feature vectors")
    print(f"    • {len(USER_IDS)} inference vectors")
    print(f"    • {len(USER_IDS)} session click histories")
    return True


def init_pgvector():
    """Populate pgvector tables with sample embeddings for ANN search."""
    try:
        import psycopg2
    except ImportError:
        print("[WARN] psycopg2 not installed. Skipping pgvector init.")
        print("       Install with: pip install psycopg2-binary")
        return False

    print("\n--- Initializing pgvector Embeddings ---")

    try:
        conn = psycopg2.connect(VECTOR_DB_URL)
        cur = conn.cursor()
        print(f"  Connected to vector database")
    except Exception as e:
        print(f"  [WARN] Cannot connect to vector DB: {e}")
        print("  Skipping pgvector initialization.")
        return False

    # Generate and insert event embeddings
    print("  Inserting event embeddings...")
    for event_id in EVENT_IDS:
        embedding = generate_embedding(f"event_embedding:{event_id}:v1")
        category = np.random.choice(CATEGORIES)
        metadata = {
            "category": category,
            "city": np.random.choice(["Helsinki", "Espoo", "Vantaa", "Tampere"]),
            "genres": np.random.choice(
                ["jazz", "rock", "classical", "electronic", "indie", "pop"],
                size=np.random.randint(1, 4), replace=False,
            ).tolist(),
            "price_tier": np.random.choice(["free", "budget", "standard", "premium", "vip"]),
            "max_attendees": int(np.random.choice([20, 30, 50, 100, 200, 500])),
        }
        cur.execute(
            """INSERT INTO event_embeddings (event_id, embedding, metadata, created_at, updated_at)
               VALUES (%s, %s, %s, NOW(), NOW())
               ON CONFLICT (event_id) DO UPDATE SET
                 embedding = EXCLUDED.embedding,
                 metadata = EXCLUDED.metadata,
                 updated_at = NOW()""",
            (event_id, embedding, json.dumps(metadata)),
        )

    # Generate and insert user embeddings
    print("  Inserting user embeddings...")
    for user_id in USER_IDS:
        embedding = generate_embedding(f"user_embedding:{user_id}:v1")
        cur.execute(
            """INSERT INTO user_embeddings (user_id, embedding, updated_at)
               VALUES (%s, %s, NOW())
               ON CONFLICT (user_id) DO UPDATE SET
                 embedding = EXCLUDED.embedding,
                 updated_at = NOW()""",
            (user_id, embedding),
        )

    conn.commit()

    # Verify counts
    cur.execute("SELECT COUNT(*) FROM event_embeddings")
    event_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM user_embeddings")
    user_count = cur.fetchone()[0]

    cur.close()
    conn.close()

    print(f"  pgvector initialized successfully!")
    print(f"    • {event_count} event embeddings (64-dim, HNSW-indexed)")
    print(f"    • {user_count} user embeddings (64-dim, HNSW-indexed)")

    # Test ANN search
    print("  Testing ANN search...")
    try:
        conn = psycopg2.connect(VECTOR_DB_URL)
        cur = conn.cursor()
        test_vec = generate_embedding("test_query:v1")
        cur.execute(
            """SELECT event_id, 1 - (embedding <=> %s::vector) AS similarity
               FROM event_embeddings
               ORDER BY embedding <=> %s::vector
               LIMIT 5""",
            (test_vec, test_vec),
        )
        results = cur.fetchall()
        print("  Top 5 ANN results:")
        for event_id, similarity in results:
            print(f"    {event_id}: similarity={similarity:.4f}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"  [WARN] ANN test query failed: {e}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Initialize ML pipeline sample data"
    )
    parser.add_argument("--redis-only", action="store_true",
                        help="Only initialize Redis FeatureStore")
    parser.add_argument("--pgvector-only", action="store_true",
                        help="Only initialize pgvector embeddings")
    parser.add_argument("--redis-url", type=str, default=REDIS_URL,
                        help=f"Redis URL (default: {REDIS_URL})")
    parser.add_argument("--vector-db-url", type=str, default=VECTOR_DB_URL,
                        help=f"Vector DB URL (default: {VECTOR_DB_URL})")

    args = parser.parse_args()

    global REDIS_URL, VECTOR_DB_URL
    REDIS_URL = args.redis_url
    VECTOR_DB_URL = args.vector_db_url

    print("╔══════════════════════════════════════════════════════╗")
    print("║   Polydom ML Pipeline — Sample Data Initializer     ║")
    print("╚══════════════════════════════════════════════════════╝")

    results = {}

    if not args.pgvector_only:
        results["Redis FeatureStore"] = init_redis_feature_store()

    if not args.redis_only:
        results["pgvector Embeddings"] = init_pgvector()

    print("\n==============================================")
    print("  Initialization Summary:")
    for component, ok in results.items():
        print(f"  {'✓' if ok else '✗'} {component}")
    print("\nNext steps:")
    print("  • Trigger ML training: python -m ml-training.data_pipeline")
    print("  • Start inference: uvicorn inference.api:app --port 8000")
    print("  • Generate events:  python scripts/sample-data/generate_kafka_events.py --stream")
    print("")


if __name__ == "__main__":
    main()
