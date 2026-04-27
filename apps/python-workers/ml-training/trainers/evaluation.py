#!/usr/bin/env python3
"""
Ranking evaluation metrics for recommendation models.

Metrics computed at multiple cutoffs (k ∈ {5, 10, 20, 50}):
  - NDCG@k:  Normalized Discounted Cumulative Gain
  - Recall@k: Fraction of relevant items retrieved in top-k
  - Precision@k: Fraction of top-k items that are relevant
  - MRR: Mean Reciprocal Rank (where is the first relevant item?)
  - MAP: Mean Average Precision
  - HitRate@k: Did at least one relevant item appear in top-k?
"""

from __future__ import annotations

import logging
from typing import Dict, List

import numpy as np

logger = logging.getLogger("evaluation")


def ndcg_at_k(y_true: np.ndarray, y_pred: np.ndarray, k: int = 10) -> float:
    """
    Normalized Discounted Cumulative Gain at k.

    NDCG@k = DCG@k / IDCG@k

    Args:
        y_true: Ground truth relevance scores (binary or graded)
        y_pred: Predicted scores
        k: Cutoff rank
    """
    if len(y_true) == 0 or len(y_pred) == 0:
        return 0.0

    order = np.argsort(y_pred)[::-1][:k]
    y_true_sorted = y_true[order]

    # DCG@k
    gains = 2 ** y_true_sorted - 1
    discounts = np.log2(np.arange(2, k + 2))
    dcg = np.sum(gains / discounts)

    # IDCG@k (ideal ordering)
    ideal_order = np.sort(y_true)[::-1][:k]
    ideal_gains = 2 ** ideal_order - 1
    idcg = np.sum(ideal_gains / discounts)

    return float(dcg / idcg) if idcg > 0 else 0.0


def recall_at_k(y_true: np.ndarray, y_pred: np.ndarray, k: int = 10) -> float:
    """
    Recall@k: Fraction of all relevant items that appear in top-k predictions.

    recall@k = |{relevant items in top-k}| / |{all relevant items}|
    """
    n_relevant = int(np.sum(y_true > 0))
    if n_relevant == 0:
        return 0.0

    top_k_idx = np.argsort(y_pred)[::-1][:k]
    n_relevant_in_k = int(np.sum(y_true[top_k_idx] > 0))

    return n_relevant_in_k / n_relevant


def precision_at_k(y_true: np.ndarray, y_pred: np.ndarray, k: int = 10) -> float:
    """
    Precision@k: Fraction of top-k predictions that are relevant.

    precision@k = |{relevant items in top-k}| / k
    """
    if k == 0:
        return 0.0

    top_k_idx = np.argsort(y_pred)[::-1][:min(k, len(y_pred))]
    n_relevant_in_k = int(np.sum(y_true[top_k_idx] > 0))

    return n_relevant_in_k / k


def mrr(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Mean Reciprocal Rank.

    MRR = 1 / rank_of_first_relevant_item

    Higher is better. Max = 1.0 (first item is relevant).
    """
    order = np.argsort(y_pred)[::-1]
    relevant_positions = np.where(y_true[order] > 0)[0]

    if len(relevant_positions) == 0:
        return 0.0

    first_relevant_rank = relevant_positions[0] + 1  # 1-indexed
    return 1.0 / first_relevant_rank


def average_precision(y_true: np.ndarray, y_pred: np.ndarray, k: int = 50) -> float:
    """
    Average Precision at k.

    AP@k = (1 / |relevant|) * sum_{i=1..k} precision@i * rel(i)
    """
    n_relevant = int(np.sum(y_true > 0))
    if n_relevant == 0:
        return 0.0

    order = np.argsort(y_pred)[::-1][:k]
    y_true_sorted = y_true[order]

    precision_sum = 0.0
    n_hits = 0

    for i in range(min(k, len(y_true_sorted))):
        if y_true_sorted[i] > 0:
            n_hits += 1
            precision_sum += n_hits / (i + 1)

    return precision_sum / n_relevant


def compute_ranking_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    cutoffs: List[int] = [5, 10, 20, 50],
) -> Dict[str, float]:
    """
    Compute all ranking metrics at multiple cutoffs.

    Args:
        y_true: Binary labels (1 = relevant / booked)
        y_pred: Model scores
        cutoffs: k values to evaluate at

    Returns:
        Dict of metric_name -> value
    """
    if len(y_true) == 0:
        return {f"ndcg@{k}": 0.0 for k in cutoffs} | {
            f"recall@{k}": 0.0 for k in cutoffs
        } | {
            f"precision@{k}": 0.0 for k in cutoffs
        } | {"mrr": 0.0, "map@50": 0.0}

    metrics: Dict[str, float] = {}

    for k in cutoffs:
        metrics[f"ndcg@{k}"] = ndcg_at_k(y_true, y_pred, k)
        metrics[f"recall@{k}"] = recall_at_k(y_true, y_pred, k)
        metrics[f"precision@{k}"] = precision_at_k(y_true, y_pred, k)

    metrics["mrr"] = mrr(y_true, y_pred)
    metrics["map@50"] = average_precision(y_true, y_pred, k=50)

    return metrics


def compute_user_level_metrics(
    user_groups: Dict[str, Dict[str, np.ndarray]],
    y_pred_all: np.ndarray,
    k: int = 10,
) -> Dict[str, float]:
    """
    Compute user-averaged metrics (fairer evaluation than global).

    Each user contributes equally regardless of activity volume.
    """
    user_recalls = []
    user_ndcgs = []

    offset = 0
    for user_id, group in user_groups.items():
        y_true = group["labels"]
        y_pred = y_pred_all[offset : offset + len(y_true)]
        offset += len(y_true)

        if np.sum(y_true > 0) == 0:
            continue

        user_recalls.append(recall_at_k(y_true, y_pred, k))
        user_ndcgs.append(ndcg_at_k(y_true, y_pred, k))

    return {
        f"user_avg_recall@{k}": float(np.mean(user_recalls)) if user_recalls else 0.0,
        f"user_avg_ndcg@{k}": float(np.mean(user_ndcgs)) if user_ndcgs else 0.0,
    }
