#!/usr/bin/env python3
"""
Search personalization — re-ranks raw search results with user-specific features.

Pipeline:
  1. Receive raw search results from Elasticsearch (text relevance scores)
  2. Extract full 139-dim feature vector for each (user, result_event) pair
  3. Score with LightGBM/XGBoost model (personalization score)
  4. Blend: alpha * text_score + (1-alpha) * personalization_score
  5. MMR diversity re-ranking on blended scores

The alpha parameter controls the text-relevance vs personalization trade-off:
  alpha = 1.0 → pure text search (original order)
  alpha = 0.0 → pure personalization
  alpha = 0.4 → balanced (default)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from search_ranker import SearchRanker

logger = logging.getLogger("search-personalizer")


class SearchPersonalizer:
    """
    Re-ranks search results with personalization features.

    Used by the NestJS search service: Elasticsearch provides text retrieval,
    this service applies personalization on top.
    """

    def __init__(self, ranker: SearchRanker, alpha: float = 0.4):
        """
        Args:
            ranker: SearchRanker instance with loaded model
            alpha: Blend ratio for text score vs personalization score.
                   Higher = more text relevance, lower = more personalization.
        """
        self.ranker = ranker
        self.alpha = alpha

    def personalize(
        self,
        user_id: str,
        search_results: List[Dict[str, Any]],
        user_location: Optional[Tuple[float, float]] = None,
        top_k: int = 20,
        diversity_lambda: float = 0.3,
        alpha_override: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Re-rank search results with personalization.

        Args:
            user_id: User to personalize for
            search_results: List of result dicts from Elasticsearch.
                            Each must have: id, title, category, genres,
                            plus _score (text relevance from ES, 0-1 or raw).
            user_location: Optional (lat, lon) for geo-context
            top_k: Number of results to return
            diversity_lambda: MMR trade-off (0 = pure relevance, 1 = pure diversity)
            alpha_override: Override default alpha for this request

        Returns:
            Re-ranked results with added personalization score and explanation.
        """
        if not search_results:
            return []

        alpha = alpha_override if alpha_override is not None else self.alpha

        # Normalize text scores to [0, 1]
        text_scores = np.array([
            r.get("_score", r.get("score", 0.5)) for r in search_results
        ], dtype=np.float32)
        if text_scores.max() > text_scores.min():
            text_scores = (text_scores - text_scores.min()) / (text_scores.max() - text_scores.min() + 1e-8)
        else:
            text_scores = np.ones_like(text_scores) * 0.5

        # Extract personalization features and score each result
        scored: List[Tuple[Dict, np.ndarray, float, float]] = []
        for i, result in enumerate(search_results):
            features = self.ranker.feature_extractor.extract(
                user_id, result, user_location
            )
            personalization_score = self.ranker._score(features)

            # Blend scores
            text_s = float(text_scores[i])
            blended = alpha * text_s + (1.0 - alpha) * personalization_score

            scored.append((result, features, blended, personalization_score))

        # Sort by blended score
        scored.sort(key=lambda x: x[2], reverse=True)

        # MMR diversity re-ranking on blended scores
        if diversity_lambda > 0 and len(scored) > top_k:
            ranked = self._mmr_rerank(scored, top_k, diversity_lambda)
        else:
            ranked = scored[:top_k]

        # Format response
        return [
            {
                **result,
                "personalization_score": float(pers_score),
                "blended_score": float(blended),
                "text_score": float(text_scores[i]),
                "ranking_features": self.ranker._explain(features),
            }
            for i, (result, features, blended, pers_score) in enumerate(ranked[:top_k])
        ]

    def _mmr_rerank(
        self,
        scored: List[Tuple[Dict, np.ndarray, float, float]],
        top_k: int,
        lamb: float,
    ) -> List[Tuple[Dict, np.ndarray, float, float]]:
        """
        Maximal Marginal Relevance re-ranking on blended scores.

        Uses category-based similarity for diversity.
        """
        if len(scored) <= top_k:
            return scored

        selected = [scored[0]]
        remaining = scored[1:]

        while len(selected) < top_k and remaining:
            best_score = -float("inf")
            best_idx = 0

            for i, (event, features, blended, pers) in enumerate(remaining):
                max_sim = max(
                    self._category_similarity(event, sel[0])
                    for sel in selected
                )
                mmr = lamb * blended - (1.0 - lamb) * max_sim
                if mmr > best_score:
                    best_score = mmr
                    best_idx = i

            selected.append(remaining.pop(best_idx))

        return selected

    @staticmethod
    def _category_similarity(event_a: Dict, event_b: Dict) -> float:
        """Category-based similarity for MMR diversity."""
        cat_a = event_a.get("category", "")
        cat_b = event_b.get("category", "")
        if cat_a == cat_b:
            return 1.0

        genres_a = set(event_a.get("genres", []))
        genres_b = set(event_b.get("genres", []))
        if not genres_a or not genres_b:
            return 0.0

        intersection = genres_a & genres_b
        union = genres_a | genres_b
        return len(intersection) / len(union) if union else 0.0
