#!/usr/bin/env python3
"""
Real-time session vector computation.

Computes a moving inference vector from a user's recent event activity.
This vector represents "what the user is interested in right now" and is
used to query the pgvector catalog for personalized recommendations.

Flow:
  1. Fetch embeddings of recently clicked events from pgvector
  2. Apply exponential moving average pooling → 64-dim session vector
  3. Blend with batch user vector if available (alpha blend)
  4. Cache in Redis with 30-min TTL
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger("session-vector")


class SessionVectorComputer:
    """
    Computes a real-time inference vector from recent user activity.

    The session vector captures short-term intent (last 5-10 clicks)
    and blends it with the user's long-term batch embedding.
    """

    def __init__(
        self,
        event_embeddings: Optional[Dict[str, np.ndarray]] = None,
        user_embeddings: Optional[Dict[str, np.ndarray]] = None,
        alpha: float = 0.7,
    ):
        """
        Args:
            event_embeddings: event_id → 64-dim vector (in-memory cache)
            user_embeddings: user_id → 64-dim vector (in-memory cache)
            alpha: Blend weight for session vector vs batch user vector.
                   1.0 = pure session, 0.0 = pure batch.
        """
        self.event_embeddings = event_embeddings or {}
        self.user_embeddings = user_embeddings or {}
        self.alpha = alpha

    def compute(
        self,
        user_id: str,
        recent_event_ids: List[str],
        decay: float = 0.8,
    ) -> Optional[np.ndarray]:
        """
        Compute a session inference vector from recent events.

        Uses exponential moving average: each event's embedding is weighted
        by decay^i where i is its position (more recent = higher weight).

        Then blends with the batch user vector: alpha * session + (1-alpha) * batch.

        Args:
            user_id: User to compute vector for.
            recent_event_ids: Ordered list of recently interacted event IDs
                              (most recent first).
            decay: Weight decay per position (0 < decay <= 1).

        Returns:
            64-dim numpy array, or None if no embeddings are available.
        """
        vectors = []
        weights = []

        for i, eid in enumerate(recent_event_ids):
            emb = self.event_embeddings.get(eid)
            if emb is not None and len(emb) > 0:
                vectors.append(np.asarray(emb, dtype=np.float32))
                weights.append(decay ** i)

        if not vectors:
            logger.debug("No event embeddings found for session vector (user=%s)", user_id)
            # Fall back to batch user vector only
            batch_vec = self.user_embeddings.get(user_id)
            if batch_vec is not None:
                return np.asarray(batch_vec, dtype=np.float32)
            return None

        # Weighted average of session event embeddings
        weight_sum = sum(weights)
        session_vec = np.average(vectors, axis=0, weights=weights)
        session_vec = session_vec / (np.linalg.norm(session_vec) + 1e-8)  # L2 normalize

        # Blend with batch user vector if available
        batch_vec = self.user_embeddings.get(user_id)
        if batch_vec is not None:
            batch_vec = np.asarray(batch_vec, dtype=np.float32)
            session_vec = self.alpha * session_vec + (1 - self.alpha) * batch_vec
            session_vec = session_vec / (np.linalg.norm(session_vec) + 1e-8)

        return session_vec.astype(np.float32)

    def compute_simple(
        self,
        recent_event_ids: List[str],
    ) -> Optional[np.ndarray]:
        """
        Simple mean pooling of recent event embeddings (no decay, no blend).
        """
        vectors = []
        for eid in recent_event_ids:
            emb = self.event_embeddings.get(eid)
            if emb is not None and len(emb) > 0:
                vectors.append(np.asarray(emb, dtype=np.float32))

        if not vectors:
            return None

        mean_vec = np.mean(vectors, axis=0)
        return (mean_vec / (np.linalg.norm(mean_vec) + 1e-8)).astype(np.float32)

    def update_event_cache(self, event_id: str, embedding: np.ndarray) -> None:
        self.event_embeddings[event_id] = embedding

    def update_user_cache(self, user_id: str, embedding: np.ndarray) -> None:
        self.user_embeddings[user_id] = embedding
