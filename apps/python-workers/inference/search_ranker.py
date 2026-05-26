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

import json
import logging
import math
import os
import pickle
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("inference")


class InferenceFeatureExtractor:
    """Lightweight feature extraction for a single user-event pair at inference time."""

    EARTH_RADIUS_KM = 6371.0
    N_TOTAL = 139

    def __init__(self, feature_store_url: str = "redis://localhost:6379"):
        self.feature_store_url = feature_store_url
        self._feature_store = None
        self._user_cache: Dict[str, Dict] = {}
        self._event_cache: Dict[str, Dict] = {}

    def _get_fs(self):
        if self._feature_store is None:
            sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml-training"))
            from feature_engineering import FeatureStore
            self._feature_store = FeatureStore(self.feature_store_url)
        return self._feature_store

    def extract(
        self,
        user_id: str,
        event: Dict[str, Any],
        user_location: Optional[Tuple[float, float]] = None,
    ) -> np.ndarray:
        user = self._get_user_profile(user_id)
        loc = self._location_features(user, event, user_location)
        cat = self._category_features(user, event)
        col = self._collaborative_features(user, event)
        tmp = self._temporal_features(user, event)
        eng = self._engagement_features(user, event)
        ints = self._interest_similarity_features(user, event)
        part = self._participant_features(user, event)
        return np.concatenate([loc, cat, col, tmp, eng, ints, part]).astype(np.float32)

    def _get_user_profile(self, user_id: str) -> Dict[str, Any]:
        if user_id in self._user_cache:
            return self._user_cache[user_id]
        fs = self._get_fs()
        profile = fs.load_user_profile(user_id)
        if profile:
            self._user_cache[user_id] = profile
            return profile
        return {
            "home_lat": 0.0, "home_lon": 0.0,
            "typical_radius_km": 10.0,
            "genre_affinity": {},
            "category_affinity": {},
            "user_embedding": np.zeros(64, dtype=np.float32),
        }

    def _location_features(self, user: Dict, event: Dict, user_location) -> np.ndarray:
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
            d_home, d_cur, math.log1p(d_home), math.log1p(d_cur),
            user.get("typical_radius_km", 10.0),
            float(user.get("n_unique_cities", 0)),
            float(user.get("n_unique_neighborhoods", 0)),
            user.get("location_entropy", 0.0),
            0.0, 0.0,
            float(event.get("city_popularity", 0.5)),
            float(event.get("venue_bookings", 0)),
            float(event.get("venue_repeat_rate", 0)),
            float(event.get("city") == user.get("home_city", "")),
            float(d_home <= user.get("typical_radius_km", 10.0)),
            float(event.get("venue_unique_users", 0)),
        ], dtype=np.float32)

    def _category_features(self, user: Dict, event: Dict) -> np.ndarray:
        user_cat_vec = np.zeros(9, dtype=np.float32)
        event_cat = event.get("category", "")
        return np.array([
            0.0, 0.0, 0.0, 0.0,
            *user_cat_vec[:6],
            *[1.0 if c == event_cat else 0.0 for c in
              ["CONCERT", "WORKSHOP", "JAM_SESSION", "OPEN_MIC", "FESTIVAL", "CLASS"]],
            0.0, 0.0,
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
            0.0, 7.0, 0.0, 0.0, 0.0, 0.0,
            float(now.hour), float(now.weekday()),
            1.0 if now.weekday() >= 5 else 0.0, 0.0,
        ], dtype=np.float32)

    def _engagement_features(self, user: Dict, event: Dict) -> np.ndarray:
        ue = user.get("engagement", {})
        return np.array([
            ue.get("total_activities", 0), ue.get("view_to_click_rate", 0),
            ue.get("click_to_book_rate", 0), ue.get("view_to_book_rate", 0),
            ue.get("avg_dwell_ms", 0) / 1000.0, ue.get("avg_session_duration_s", 0),
            ue.get("search_frequency", 0), ue.get("rec_impressions", 0),
            ue.get("rec_ctr", 0), ue.get("rec_conversion_rate", 0),
            ue.get("rec_dismissal_rate", 0), 0.0, 0.0, 0.0,
            1.0 if ue.get("total_activities", 0) > 100 else 0.0,
        ], dtype=np.float32)

    def _interest_similarity_features(self, user: Dict, event: Dict) -> np.ndarray:
        user_interests = user.get("interests", [])
        user_interest_vec = user.get("interest_vector", np.zeros(5, dtype=np.float32))
        event_tags = event.get("genres", [])
        event_tag_vec = event.get("tag_vector", np.zeros(5, dtype=np.float32))
        user_set = set((i.lower().strip() if isinstance(i, str) else str(i)) for i in user_interests)
        event_set = set((t.lower().strip() if isinstance(t, str) else str(t)) for t in event_tags)
        inter = user_set & event_set
        jaccard = len(inter) / max(len(user_set | event_set), 1)
        dice = (2.0 * len(inter)) / max(len(user_set) + len(event_set), 1)
        return np.array([
            jaccard, dice, float(len(inter)),
            len(inter) / max(len(user_set), 1),
            len(inter) / max(len(event_set), 1),
            float(len(inter)) / max(len(user_set), 1) * math.log1p(len(inter)),
            *user_interest_vec[:5], *event_tag_vec[:5],
            0.0, 1.0 if inter else 0.0,
        ], dtype=np.float32)

    def _participant_features(self, user: Dict, event: Dict) -> np.ndarray:
        cd = user.get("coattendee_data", {})
        return np.array([
            cd.get("coattendee_count", 0), math.log1p(cd.get("coattendee_count", 0)),
            cd.get("avg_events", 0), cd.get("cohort_diversity", 0),
            cd.get("jaccard_mean", 0), cd.get("jaccard_max", 0),
            cd.get("n_common_events", 0), cd.get("category_affinity", 0),
            cd.get("genre_affinity", 0), cd.get("event_popularity", 0),
            cd.get("cohort_size_norm", 0), cd.get("genre_diversity", 0),
            cd.get("recency_days", 365.0), cd.get("avg_shared", 0),
            min(cd.get("coattendee_count_log", 0) / 10.0, 1.0),
            min(cd.get("category_affinity", 0), 1.0),
        ], dtype=np.float32)

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2):
        dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
        a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        return 6371.0 * 2 * math.asin(math.sqrt(a))


class SearchRanker:
    """Ranks events for a user using the trained model pipeline."""

    def __init__(self, model_path: Optional[str] = None):
        self.model: Any = None
        self.feature_extractor = None
        self.feature_names: List[str] = []
        if model_path:
            self._load_model(model_path)
        else:
            self._load_latest_model()

    def _load_latest_model(self) -> None:
        model_dir = os.getenv("MODEL_PATH", "/data/training/models")
        latest_file = os.path.join(model_dir, "latest_model.txt")
        if os.path.exists(latest_file):
            with open(latest_file, "r") as f:
                model_path = f.read().strip()
            if os.path.exists(model_path):
                self._load_model(model_path)
                return
        if os.path.isdir(model_dir):
            pkl_files = sorted([f for f in os.listdir(model_dir) if f.endswith(".pkl") and f.startswith("ranker_")], reverse=True)
            if pkl_files:
                self._load_model(os.path.join(model_dir, pkl_files[0]))
                return
        logger.warning("No model found in %s", model_dir)

    def _load_model(self, model_path: str) -> None:
        fs_url = os.getenv("FEATURE_STORE_URL", "redis://localhost:6379")
        try:
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)
            self.feature_extractor = InferenceFeatureExtractor(fs_url)
            self.feature_names = getattr(self.model, "feature_names_", [])
            logger.info("Loaded model: %s (%d features)", model_path, len(self.feature_names))
        except Exception as e:
            logger.error("Failed to load model from %s: %s", model_path, e)

    def _score(self, features: np.ndarray) -> float:
        if self.model is None:
            return 0.0
        try:
            if hasattr(self.model, "predict"):
                return float(self.model.predict(features.reshape(1, -1))[0])
        except Exception as e:
            logger.warning("Model scoring failed: %s", e)
        return 0.0

    def rank(self, user_id: str, candidates: List[Dict[str, Any]], top_k: int = 10, user_location=None) -> List[Dict[str, Any]]:
        if not candidates:
            return []
        if self.feature_extractor is None:
            return candidates[:top_k]
        scores = []
        for event in candidates:
            features = self.feature_extractor.extract(user_id, event, user_location)
            score = self._score(features)
            scores.append((event, features, score))
        scores.sort(key=lambda x: x[2], reverse=True)
        diverse = self._mmr_diversity(scores, top_k, lamb=0.7)
        return [{"id": e.get("id", ""), "title": e.get("title", "Unknown"), "category": e.get("category", ""), "genres": e.get("genres", []), "relevance_score": float(s)} for e, _, s in diverse]

    def _mmr_diversity(self, scored, top_k, lamb):
        if len(scored) <= top_k:
            return scored
        selected = [scored[0]]
        remaining = scored[1:]
        while len(selected) < top_k and remaining:
            best_score, best_idx = -float("inf"), 0
            for i, (event, _, score) in enumerate(remaining):
                max_sim = max(self._category_similarity(event, se) for se, _, _ in selected)
                mmr = lamb * score - (1 - lamb) * max_sim
                if mmr > best_score:
                    best_score, best_idx = mmr, i
            selected.append(remaining.pop(best_idx))
        return selected

    @staticmethod
    def _category_similarity(a, b):
        if a.get("category", "") == b.get("category", "") and a.get("category"):
            return 1.0
        ga = set(g.lower() for g in a.get("genres", []))
        gb = set(g.lower() for g in b.get("genres", []))
        inter = ga & gb
        return len(inter) / max(len(ga | gb), 1)
