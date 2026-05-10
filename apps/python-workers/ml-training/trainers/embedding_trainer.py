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
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np

logger = logging.getLogger("embedding-trainer")

# ═══════════════════════════════════════════════════════════════════════════
# PyTorch Two-Tower Model
# ═══════════════════════════════════════════════════════════════════════════

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import torch.optim as optim
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logger.warning("PyTorch not installed — neural network training disabled")


class UserTower(nn.Module):
    """Maps user features to L2-normalized embedding."""

    def __init__(
        self,
        input_dim: int,
        hidden_dims: list = None,
        output_dim: int = 64,
        dropout: float = 0.2,
    ):
        super().__init__()
        if hidden_dims is None:
            hidden_dims = [256, 128]

        layers = []
        prev = input_dim
        for h in hidden_dims:
            layers.extend([
                nn.Linear(prev, h),
                nn.BatchNorm1d(h),
                nn.ReLU(),
                nn.Dropout(dropout),
            ])
            prev = h
        layers.append(nn.Linear(prev, output_dim))
        self.net = nn.Sequential(*layers)

    def forward(self, x: "torch.Tensor") -> "torch.Tensor":
        emb = self.net(x)
        return F.normalize(emb, p=2, dim=1)


class EventTower(nn.Module):
    """Maps event features to L2-normalized embedding."""

    def __init__(
        self,
        input_dim: int,
        hidden_dims: list = None,
        output_dim: int = 64,
        dropout: float = 0.2,
    ):
        super().__init__()
        if hidden_dims is None:
            hidden_dims = [256, 128]

        layers = []
        prev = input_dim
        for h in hidden_dims:
            layers.extend([
                nn.Linear(prev, h),
                nn.BatchNorm1d(h),
                nn.ReLU(),
                nn.Dropout(dropout),
            ])
            prev = h
        layers.append(nn.Linear(prev, output_dim))
        self.net = nn.Sequential(*layers)

    def forward(self, x: "torch.Tensor") -> "torch.Tensor":
        emb = self.net(x)
        return F.normalize(emb, p=2, dim=1)


class TwoTowerModel(nn.Module):
    """
    Combined two-tower model for training and inference.

    Produces L2-normalized 64-dim embeddings for users and events.
    """

    def __init__(
        self,
        user_input_dim: int,
        event_input_dim: int,
        hidden_dims: list = None,
        output_dim: int = 64,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.user_tower = UserTower(user_input_dim, hidden_dims, output_dim, dropout)
        self.event_tower = EventTower(event_input_dim, hidden_dims, output_dim, dropout)
        self.output_dim = output_dim

    def forward(
        self,
        user_features: "torch.Tensor",
        event_features: "torch.Tensor",
    ) -> "Tuple[torch.Tensor, torch.Tensor]":
        user_emb = self.user_tower(user_features)
        event_emb = self.event_tower(event_features)
        return user_emb, event_emb

    def encode_user(self, user_features: "torch.Tensor") -> "torch.Tensor":
        with torch.no_grad():
            return self.user_tower(user_features)

    def encode_event(self, event_features: "torch.Tensor") -> "torch.Tensor":
        with torch.no_grad():
            return self.event_tower(event_features)


# ═══════════════════════════════════════════════════════════════════════════
# Embedding Trainer
# ═══════════════════════════════════════════════════════════════════════════

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

        # Train proper neural network if PyTorch is available
        if HAS_TORCH and os.getenv("USE_NEURAL_EMBEDDINGS", "0") == "1":
            self._train_neural_network(
                user_matrix, event_matrix, positive_pairs, negative_pairs,
                user_ids, event_ids,
            )

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
        user_ids: List[str],
        event_ids: List[str],
    ) -> None:
        """
        Train two-tower model with InfoNCE contrastive loss.

        Architecture:
          User tower:  input → Dense(256) → BN → ReLU → Dropout(0.2) →
                              Dense(128) → BN → ReLU → Dense(64) → L2_Norm
          Event tower: same architecture

        Loss: InfoNCE (contrastive) with temperature scaling.
          For each positive pair (u, e+), negative events are sampled
          from the same batch (in-batch negatives) plus explicit negatives.

        Optimizer: AdamW with cosine annealing LR schedule.
        """
        if not HAS_TORCH:
            logger.warning("PyTorch not available — falling back to SVD baseline")
            return

        user_dim = user_matrix.shape[1]
        event_dim = event_matrix.shape[1]

        # Build lookup dicts
        user_idx = {uid: i for i, uid in enumerate(user_ids)}
        event_idx = {eid: i for i, eid in enumerate(event_ids)}

        # Create positive pair indices
        pos_users = []
        pos_events = []
        for uid, eid in positive_pairs:
            if uid in user_idx and eid in event_idx:
                pos_users.append(user_idx[uid])
                pos_events.append(event_idx[eid])

        if len(pos_users) == 0:
            logger.warning("No valid positive pairs for neural training")
            return

        pos_users = np.array(pos_users)
        pos_events = np.array(pos_events)

        # Create negative pairs (in-batch negatives + explicit)
        neg_users = []
        neg_events = []
        if negative_pairs:
            for uid, eid in negative_pairs:
                if uid in user_idx and eid in event_idx:
                    neg_users.append(user_idx[uid])
                    neg_events.append(event_idx[eid])

        logger.info(
            "Neural training: %d positive pairs, %d explicit negative pairs, %d users, %d events",
            len(pos_users), len(neg_users), len(user_ids), len(event_ids),
        )

        # Initialize model
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = TwoTowerModel(
            user_input_dim=user_dim,
            event_input_dim=event_dim,
            hidden_dims=[256, 128],
            output_dim=self.embedding_dim,
            dropout=0.2,
        ).to(device)

        optimizer = optim.AdamW(model.parameters(), lr=self.learning_rate, weight_decay=1e-5)
        scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=self.epochs)

        # Convert matrices to tensors
        user_tensor = torch.tensor(user_matrix, dtype=torch.float32, device=device)
        event_tensor = torch.tensor(event_matrix, dtype=torch.float32, device=device)
        pos_users_tensor = torch.tensor(pos_users, dtype=torch.long, device=device)
        pos_events_tensor = torch.tensor(pos_events, dtype=torch.long, device=device)

        neg_users_tensor = None
        neg_events_tensor = None
        if neg_users:
            neg_users_tensor = torch.tensor(neg_users, dtype=torch.long, device=device)
            neg_events_tensor = torch.tensor(neg_events, dtype=torch.long, device=device)

        # Training loop
        n_pos = len(pos_users)
        batch_size = min(self.batch_size, n_pos)

        for epoch in range(self.epochs):
            model.train()
            total_loss = 0.0
            n_batches = 0

            # Shuffle
            perm = torch.randperm(n_pos, device=device)
            pos_users_shuffled = pos_users_tensor[perm]
            pos_events_shuffled = pos_events_tensor[perm]

            for start in range(0, n_pos, batch_size):
                end = min(start + batch_size, n_pos)
                batch_u_idx = pos_users_shuffled[start:end]
                batch_e_idx = pos_events_shuffled[start:end]

                batch_users = user_tensor[batch_u_idx]
                batch_pos_events = event_tensor[batch_e_idx]

                # Forward
                user_emb, event_emb = model(batch_users, batch_pos_events)
                # user_emb: (batch, dim), event_emb: (batch, dim)

                # InfoNCE loss: for each user, the correct event is the positive
                # Logits: (batch, batch) — dot product with all events in batch
                logits = torch.matmul(user_emb, event_emb.T) / self.temperature
                labels = torch.arange(len(batch_u_idx), device=device)

                # Add explicit negatives if available (append as extra columns)
                if neg_users_tensor is not None and len(neg_users_tensor) > 0:
                    # Sample some negatives for this batch
                    n_sample = min(len(neg_users_tensor), batch_size * 2)
                    neg_perm = torch.randperm(len(neg_users_tensor), device=device)[:n_sample]
                    neg_event_batch = event_tensor[neg_events_tensor[neg_perm]]
                    neg_emb = model.event_tower(neg_event_batch)
                    extra_logits = torch.matmul(user_emb, neg_emb.T) / self.temperature
                    logits = torch.cat([logits, extra_logits], dim=1)

                loss = F.cross_entropy(logits, labels)

                # Backward
                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
                optimizer.step()

                total_loss += loss.item()
                n_batches += 1

            scheduler.step()
            avg_loss = total_loss / max(n_batches, 1)

            if epoch % 5 == 0 or epoch == self.epochs - 1:
                logger.info("Epoch %d/%d: loss=%.4f, lr=%.6f",
                           epoch + 1, self.epochs, avg_loss,
                           scheduler.get_last_lr()[0])

        # Extract embeddings for all users and events
        model.eval()
        with torch.no_grad():
            all_user_emb = model.encode_user(user_tensor).cpu().numpy()
            all_event_emb = model.encode_event(event_tensor).cpu().numpy()

        # Store embeddings
        for i, uid in enumerate(user_ids):
            self.user_embeddings[uid] = all_user_emb[i].astype(np.float32)

        for j, eid in enumerate(event_ids):
            self.event_embeddings[eid] = all_event_emb[j].astype(np.float32)

        logger.info(
            "Neural training complete: %d user embeddings, %d event embeddings (dim=%d)",
            len(self.user_embeddings), len(self.event_embeddings), self.embedding_dim,
        )

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

        # Write a "latest" pointer for inference auto-discovery
        latest_path = os.path.join(self.output_path, "latest_embeddings.txt")
        with open(latest_path, "w") as f:
            f.write(filepath)

        return filepath
