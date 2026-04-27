#!/usr/bin/env python3
"""
Two-tower neural network for learning user and event embeddings.

Architecture:
  User Tower:  user_features → Dense(128) → Dense(64) → L2_Norm → user_embedding
  Event Tower: event_features → Dense(128) → Dense(64) → L2_Norm → event_embedding

  Loss: Dot product of normalized embeddings, trained with contrastive loss
        (positive pairs from bookings, negative pairs from impressions without booking).

The learned embeddings are used for:
  - ANN (approximate nearest neighbor) candidate retrieval
  - Cold-start via content-side feature projection
  - Similar-item recommendations
"""

from __future__ import annotations

import logging
import os
import pickle
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("embedding-trainer")


class EmbeddingTrainer:
    """
    Trains a two-tower embedding model for user and event representations.

    The model maps users and events into a shared 64-dimensional embedding
    space where cosine similarity predicts booking affinity.
    """

    EMBEDDING_DIM = 64

    def __init__(
        self,
        output_path: str = "/data/training/models",
        embedding_dim: int = 64,
        learning_rate: float = 0.001,
        batch_size: int = 256,
        epochs: int = 20,
        temperature: float = 0.07,
    ):
        self.output_path = output_path
        self.embedding_dim = embedding_dim
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.epochs = epochs
        self.temperature = temperature
        self.user_model: Any = None
        self.event_model: Any = None
        self.user_embeddings: Dict[str, np.ndarray] = {}
        self.event_embeddings: Dict[str, np.ndarray] = {}

    def train(
        self,
        user_features: Dict[str, np.ndarray],
        event_features: Dict[str, np.ndarray],
        positive_pairs: List[Tuple[str, str]],
        negative_pairs: Optional[List[Tuple[str, str]]] = None,
    ) -> str:
        """
        Train the two-tower model.

        Args:
            user_features: user_id -> feature vector
            event_features: event_id -> feature vector
            positive_pairs: List of (user_id, event_id) — bookings, saves
            negative_pairs: List of (user_id, event_id) — impressions without engagement
        """
        logger.info("Training two-tower embeddings: users=%d, events=%d, positive_pairs=%d",
                     len(user_features), len(event_features), len(positive_pairs))

        # For simple dev training with numpy, use a cosine-embedding approach
        # In production: use TensorFlow/PyTorch with proper contrastive loss

        if len(positive_pairs) == 0:
            logger.warning("No positive pairs, skipping embedding training")
            return ""

        # Build user and event feature matrices
        user_ids = list(user_features.keys())
        event_ids = list(event_features.keys())

        user_matrix = np.array([user_features[uid] for uid in user_ids], dtype=np.float32)
        event_matrix = np.array([event_features[eid] for eid in event_ids], dtype=np.float32)

        # Train with sklearn SVD as a simple matrix factorization baseline,
        # then project to shared space
        self._train_svd_baseline(user_ids, event_ids, positive_pairs)

        # In production, train proper neural nets with TensorFlow/PyTorch:
        # self._train_neural_network(user_matrix, event_matrix, positive_pairs, negative_pairs)

        model_path = self._save_embeddings(user_ids, event_ids)

        return model_path

    def _train_svd_baseline(
        self,
        user_ids: List[str],
        event_ids: List[str],
        positive_pairs: List[Tuple[str, str]],
    ) -> None:
        """
        Baseline: Build interaction matrix and factorize with TruncatedSVD.

        Maps users and events into a shared k-dimensional space where
        dot product reconstructs the interaction matrix.
        """
        from sklearn.decomposition import TruncatedSVD
        from scipy.sparse import coo_matrix

        user_idx = {uid: i for i, uid in enumerate(user_ids)}
        event_idx = {eid: i for i, eid in enumerate(event_ids)}

        rows, cols, data = [], [], []
        for uid, eid in positive_pairs:
            if uid in user_idx and eid in event_idx:
                rows.append(user_idx[uid])
                cols.append(event_idx[eid])
                data.append(1.0)

        if len(rows) == 0:
            return

        R = coo_matrix(
            (data, (rows, cols)),
            shape=(len(user_ids), len(event_ids)),
            dtype=np.float32,
        )

        svd = TruncatedSVD(n_components=self.embedding_dim, random_state=42)
        user_latent = svd.fit_transform(R)           # (n_users, k)
        event_latent = svd.components_.T             # (n_events, k)

        # Store embeddings
        for i, uid in enumerate(user_ids):
            vec = user_latent[i]
            self.user_embeddings[uid] = vec / (np.linalg.norm(vec) + 1e-8)

        for j, eid in enumerate(event_ids):
            vec = event_latent[j]
            self.event_embeddings[eid] = vec / (np.linalg.norm(vec) + 1e-8)

        logger.info("SVD baseline trained: explained_variance_ratio sum = %.3f",
                     float(np.sum(svd.explained_variance_ratio_)))

    def _train_neural_network(
        self,
        user_matrix: np.ndarray,
        event_matrix: np.ndarray,
        positive_pairs: List[Tuple[str, str]],
        negative_pairs: Optional[List[Tuple[str, str]]],
    ) -> None:
        """
        Production two-tower training with PyTorch/TensorFlow.

        Placeholder for production implementation:
          - User tower:  Dense(256) → BatchNorm → ReLU → Dropout(0.2) →
                          Dense(128) → BatchNorm → ReLU → Dense(64) → L2_Norm
          - Event tower: same architecture
          - Loss: sampled softmax / InfoNCE contrastive loss
          - Optimizer: AdamW with cosine LR schedule
          - Hard negative mining from within-batch negatives
        """
        pass

    def get_user_embedding(self, user_id: str) -> np.ndarray:
        return self.user_embeddings.get(user_id, np.zeros(self.embedding_dim, dtype=np.float32))

    def get_event_embedding(self, event_id: str) -> np.ndarray:
        return self.event_embeddings.get(event_id, np.zeros(self.embedding_dim, dtype=np.float32))

    def find_similar_events(
        self,
        event_id: str,
        top_k: int = 20,
    ) -> List[Tuple[str, float]]:
        """Find events with similar embeddings (for similar-event recommendations)."""
        target = self.get_event_embedding(event_id)
        if np.linalg.norm(target) == 0:
            return []

        scores = []
        for eid, emb in self.event_embeddings.items():
            if eid != event_id:
                sim = float(np.dot(target, emb))  # cosine since normalized
                scores.append((eid, sim))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    def find_candidates_for_user(
        self,
        user_id: str,
        top_k: int = 100,
    ) -> List[Tuple[str, float]]:
        """Retrieve top-K event candidates for a user via embedding dot product."""
        user_emb = self.get_user_embedding(user_id)
        if np.linalg.norm(user_emb) == 0:
            return []

        scores = []
        for eid, emb in self.event_embeddings.items():
            score = float(np.dot(user_emb, emb))
            scores.append((eid, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    def _save_embeddings(self, user_ids: List[str], event_ids: List[str]) -> str:
        """Save embeddings to disk."""
        os.makedirs(self.output_path, exist_ok=True)

        version = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filepath = os.path.join(self.output_path, f"embeddings_v{version}.pkl")

        data = {
            "user_embeddings": self.user_embeddings,
            "event_embeddings": self.event_embeddings,
            "embedding_dim": self.embedding_dim,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "n_users": len(self.user_embeddings),
            "n_events": len(self.event_embeddings),
        }

        with open(filepath, "wb") as f:
            pickle.dump(data, f)

        logger.info("Embeddings saved: %s (%d users, %d events)",
                     filepath, len(self.user_embeddings), len(self.event_embeddings))

        return filepath
