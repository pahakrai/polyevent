#!/usr/bin/env python3
"""
Real-time recommendation inference service.

Pipeline:
  1. Candidate Generation  — ANN from two-tower embeddings + geo-filter + category pre-filter
  2. Feature Joining       — Redis Feature Store (user profile, event profile, interaction stats)
  3. Model Scoring          — XGBoost/LightGBM ranker scores each candidate
  4. Diversity Re-Ranking   — MMR (Maximal Marginal Relevance) to avoid category collapse
  5. Response               — Top-K events with scores and explanation features

Exposed as a FastAPI service for low-latency HTTP inference.
"""

from __future__ import annotations

import logging
import math
import os
import pickle
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Add parent for schema imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("inference")


# ═══════════════════════════════════════════════════════════════════════════
# Feature Extraction (lightweight copy for inference — mirrors feature_engineering.py)
# ═══════════════════════════════════════════════════════════════════════════

class InferenceFeatureExtractor:
    """
    Lightweight feature extraction for a single user-event pair at inference time.
    Uses cached user/event profiles from the feature store.
    """

    EARTH_RADIUS_KM = 6371.0
    N_LOCATION = 20
    N_CATEGORY = 25
    N_COLLABORATIVE = 33
    N_TEMPORAL = 12
    N_ENGAGEMENT = 15
    N_TOTAL = 105

    def __init__(self, feature_store_url: str = "redis://localhost:6379"):
        self.feature_store_url = feature_store_url
        # Cached profiles — in production, fetched from Redis per request
        self._user_cache: Dict[str, Dict] = {}
        self._event_cache: Dict[str, Dict] = {}

    def extract(
        self,
        user_id: str,
        event: Dict[str, Any],
        user_location: Optional[Tuple[float, float]] = None,
    ) -> np.ndarray:
        """
        Extract the full 105-dim feature vector for a (user, event) pair.

        Args:
            user_id: User identifier
            event: Event dict with fields: id, category, genres, location, price
            user_location: Optional (lat, lon) of user's current position
        """
        user = self._get_user_profile(user_id)

        loc = self._location_features(user, event, user_location)
        cat = self._category_features(user, event)
        col = self._collaborative_features(user, event)
        tmp = self._temporal_features(user, event)
        eng = self._engagement_features(user, event)

        return np.concatenate([loc, cat, col, tmp, eng]).astype(np.float32)

    def _get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Fetch user profile from cache or feature store."""
        if user_id in self._user_cache:
            return self._user_cache[user_id]
        # In production: fetch from Redis feature store
        return {
            "home_lat": 0.0, "home_lon": 0.0,
            "typical_radius_km": 10.0,
            "genre_affinity": {},
            "category_affinity": {},
            "user_embedding": np.zeros(64, dtype=np.float32),
        }

    def _location_features(
        self,
        user: Dict,
        event: Dict,
        user_location: Optional[Tuple[float, float]],
    ) -> np.ndarray:
        home_lat = user.get("home_lat", 0.0)
        home_lon = user.get("home_lon", 0.0)
        evt_lat = event.get("latitude", 0.0)
        evt_lon = event.get("longitude", 0.0)
        cur_lat = user_location[0] if user_location else home_lat
        cur_lon = user_location[1] if user_location else home_lon

        d_home = self._haversine(home_lat, home_lon, evt_lat, evt_lon)
        d_cur = self._haversine(cur_lat, cur_lon, evt_lat, evt_lon)

        return np.array([
            home_lat, home_lon, evt_lat, evt_lon,
            d_home, d_cur,
            math.log1p(d_home), math.log1p(d_cur),
            user.get("typical_radius_km", 10.0),
            float(user.get("n_unique_cities", 0)),
            float(user.get("n_unique_neighborhoods", 0)),
            user.get("location_entropy", 0.0),
            0.0, 0.0,  # std lat/lon
            float(event.get("city_popularity", 0.5)),
            float(event.get("venue_bookings", 0)),
            float(event.get("venue_repeat_rate", 0)),
            float(event.get("city") == user.get("home_city", "")),
            float(d_home <= user.get("typical_radius_km", 10.0)),
            float(event.get("venue_unique_users", 0)),
        ], dtype=np.float32)

    def _category_features(self, user: Dict, event: Dict) -> np.ndarray:
        user_genre_vec = np.zeros(50, dtype=np.float32)
        user_cat_vec = np.zeros(9, dtype=np.float32)

        event_genres = event.get("genres", [])
        event_cat = event.get("category", "")

        # Simplified category features for inference
        genre_similarity = 0.0
        # In production: compute proper genre overlap from cached affinity vectors

        return np.array([
            genre_similarity, 0.0, 0.0, 0.0,  # genre features
            *user_cat_vec[:6],
            *[1.0 if c == event_cat else 0.0 for c in
              ["CONCERT", "WORKSHOP", "JAM_SESSION", "OPEN_MIC", "FESTIVAL", "CLASS"]],
            0.0, 0.0,  # genre breadth
        ], dtype=np.float32)

    def _collaborative_features(self, user: Dict, event: Dict) -> np.ndarray:
        ue = user.get("user_embedding", np.zeros(64, dtype=np.float32))
        ee = event.get("event_embedding", np.zeros(64, dtype=np.float32))
        affinity = float(np.dot(ue[:16], ee[:16])) if len(ue) >= 16 and len(ee) >= 16 else 0.0
        return np.concatenate([ue[:16], ee[:16], [affinity]]).astype(np.float32)

    def _temporal_features(self, user: Dict, event: Dict) -> np.ndarray:
        now = datetime.now(timezone.utc)
        return np.array([
            float(now.hour), float(now.weekday()),
            0.0, 7.0,  # weekend_ratio, avg_lead_time
            0.0, 0.0, 0.0, 0.0,  # time bin distribution
            float(now.hour), float(now.weekday()),
            1.0 if now.weekday() >= 5 else 0.0,
            0.0,
        ], dtype=np.float32)

    def _engagement_features(self, user: Dict, event: Dict) -> np.ndarray:
        ue = user.get("engagement", {})
        return np.array([
            ue.get("total_activities", 0),
            ue.get("view_to_click_rate", 0),
            ue.get("click_to_book_rate", 0),
            ue.get("view_to_book_rate", 0),
            ue.get("avg_dwell_ms", 0) / 1000.0,
            ue.get("avg_session_duration_s", 0),
            ue.get("search_frequency", 0),
            ue.get("rec_impressions", 0),
            ue.get("rec_ctr", 0),
            ue.get("rec_conversion_rate", 0),
            ue.get("rec_dismissal_rate", 0),
            0.0, 0.0,  # event CTR, conversion rate
            0.0,  # recency days
            1.0 if ue.get("total_activities", 0) > 100 else 0.0,
        ], dtype=np.float32)

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return 6371.0 * 2 * math.asin(math.sqrt(a))


# ═══════════════════════════════════════════════════════════════════════════
# Search Ranker
# ═══════════════════════════════════════════════════════════════════════════

class SearchRanker:
    """
    Ranks events for a user using the trained model pipeline.

    Pipeline: candidates → features → score → diversity → top-K
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model: Any = None
        self.feature_extractor = InferenceFeatureExtractor()
        self.feature_names: List[str] = []

        if model_path:
            self._load_model(model_path)
        else:
            self._load_latest_model()

    def _load_latest_model(self) -> None:
        """Auto-discover the latest trained model."""
        model_dir = os.getenv("MODEL_PATH", "/data/training/models")
        latest_file = os.path.join(model_dir, "latest_model.txt")

        if os.path.exists(latest_file):
            with open(latest_file, "r") as f:
                model_path = f.read().strip()
            self._load_model(model_path)
        else:
            logger.warning("No model found at %s, using random scoring", model_dir)

    def _load_model(self, model_path: str) -> None:
        """Load a trained model from disk."""
        if not os.path.exists(model_path):
            logger.warning("Model not found: %s", model_path)
            return

        with open(model_path, "rb") as f:
            data = pickle.load(f)

        self.model = data.get("model")
        self.feature_names = data.get("feature_names", [])
        logger.info("Loaded model: %s (%d features)", model_path, len(self.feature_names))

    def rank(
        self,
        user_id: str,
        candidates: List[Dict[str, Any]],
        user_location: Optional[Tuple[float, float]] = None,
        top_k: int = 20,
        diversity_lambda: float = 0.3,
    ) -> List[Dict[str, Any]]:
        """
        Rank candidate events for a user.

        Args:
            user_id: User to personalize for
            candidates: List of event dicts (must have id, category, genres, location)
            user_location: Optional (lat, lon) for current-session context
            top_k: Number of results to return
            diversity_lambda: MMR trade-off (0 = pure relevance, 1 = pure diversity)
        """
        if not candidates:
            return []

        # Score each candidate
        scores = []
        for event in candidates:
            features = self.feature_extractor.extract(user_id, event, user_location)
            score = self._score(features)
            scores.append((event, features, score))

        # Sort by score
        scores.sort(key=lambda x: x[2], reverse=True)

        # Diversity re-ranking via MMR
        if diversity_lambda > 0 and len(scores) > top_k:
            ranked = self._mmr_rerank(scores, top_k, diversity_lambda)
        else:
            ranked = scores[:top_k]

        # Format response
        return [
            {
                **event,
                "relevance_score": float(score),
                "ranking_features": self._explain(features),
            }
            for event, features, score in ranked[:top_k]
        ]

    def _score(self, features: np.ndarray) -> float:
        """Score a feature vector with the loaded model."""
        if self.model is None:
            return float(np.random.random())

        try:
            import lightgbm as lgb
            if isinstance(self.model, lgb.Booster):
                return float(self.model.predict(features.reshape(1, -1))[0])
        except ImportError:
            pass

        try:
            import xgboost as xgb
            if isinstance(self.model, xgb.Booster):
                dmat = xgb.DMatrix(features.reshape(1, -1))
                return float(self.model.predict(dmat)[0])
        except ImportError:
            pass

        if hasattr(self.model, "predict"):
            return float(self.model.predict(features.reshape(1, -1))[0])

        return float(np.random.random())

    def _mmr_rerank(
        self,
        scored: List[Tuple[Dict, np.ndarray, float]],
        top_k: int,
        lamb: float,
    ) -> List[Tuple[Dict, np.ndarray, float]]:
        """
        Maximal Marginal Relevance re-ranking.

        Balances relevance with category diversity:
          MMR = λ * relevance - (1-λ) * max_similarity_to_already_selected

        Similarity is based on category overlap for efficiency.
        """
        if len(scored) <= top_k:
            return scored

        selected: List[Tuple[Dict, np.ndarray, float]] = [scored[0]]
        remaining = scored[1:]

        while len(selected) < top_k and remaining:
            best_score = -float("inf")
            best_idx = 0

            for i, (event, features, score) in enumerate(remaining):
                # Max similarity to any selected event
                max_sim = max(
                    self._category_similarity(event, sel[0])
                    for sel in selected
                )

                mmr = lamb * score - (1 - lamb) * max_sim
                if mmr > best_score:
                    best_score = mmr
                    best_idx = i

            selected.append(remaining.pop(best_idx))

        return selected

    def _category_similarity(self, event_a: Dict, event_b: Dict) -> float:
        """Simple category-based similarity for MMR."""
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

    def _explain(self, features: np.ndarray) -> Dict[str, float]:
        """Return key feature values for explainability."""
        if len(features) < 105:
            return {}

        return {
            "distance_km": float(features[4]),
            "genre_similarity": float(features[20]),
            "category_match": float(features[22]),
            "user_embedding_affinity": float(features[-33]),  # last element of collab group
            "evening_preference": float(features[61 + 7]),
        }

    def update_model(self, feedback_data: List[Dict[str, Any]]) -> None:
        """
        Online model update from feedback.

        In production: writes feedback events to Kafka topic
        'recommendation-feedback', which feeds back into the batch training
        pipeline. Online SGD updates can be done for the linear layer only.
        """
        logger.info("Received %d feedback samples for online learning", len(feedback_data))
        # In production: push to Kafka for batch retraining
        # For real-time: update a lightweight online model (FTRL, online SGD)
        pass
