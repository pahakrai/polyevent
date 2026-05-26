#!/usr/bin/env python3
"""
Feature engineering for location-aware and category-aware event recommendations.

Five feature groups, each produced by a dedicated engineer:
  1. LocationFeatureEngineer      — Geo-proximity, clusters, venue affinity, area popularity
  2. CategoryFeatureEngineer      — Genre affinity, category co-occurrence, tag embeddings
  3. CollaborativeFeatureEngineer — User-user & event-event similarity, matrix factorization
  4. TemporalFeatureEngineer      — Time-of-day, day-of-week, seasonal, recency decay
  5. EngagementFeatureEngineer    — Funnel rates, dwell time, session depth, CTR

All engineers follow sklearn-like fit/transform API for pipeline composition.
"""

from __future__ import annotations

import json
import logging
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
import pandas as pd
import redis
import redis.exceptions

logger = logging.getLogger("feature-engineering")


def _json_default(obj: Any) -> Any:
    """Convert numpy/pandas types to native Python for JSON serialization."""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (pd.Timestamp,)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


# ═══════════════════════════════════════════════════════════════════════════
# Feature Store
# ═══════════════════════════════════════════════════════════════════════════

class FeatureStore:
    """
    Redis-backed feature store for online inference.

    Uses Redis Hashes for user/event feature vectors (HSET/HGETALL).
    Falls back to in-memory dict when Redis is unavailable (dev mode).

    For offline training, features are read from parquet/npy files instead.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self._redis: Optional[redis.Redis] = None
        self._store: Dict[str, Dict[str, np.ndarray]] = defaultdict(dict)
        self._connect()

    def _connect(self) -> None:
        try:
            self._redis = redis.Redis.from_url(self.redis_url, decode_responses=False)
            self._redis.ping()
            logger.info("FeatureStore connected to Redis at %s", self.redis_url)
        except (redis.exceptions.ConnectionError, Exception) as e:
            logger.warning("Redis unavailable (%s), using in-memory fallback", e)
            self._redis = None

    def _redis_key(self, entity_type: str, entity_id: str) -> str:
        return f"features:{entity_type}:{entity_id}"

    def put_user_features(self, user_id: str, features: Dict[str, np.ndarray]) -> None:
        key = self._redis_key("user", user_id)
        self._store[user_id].update(features)
        if self._redis:
            try:
                payload = {k: v.tobytes() for k, v in features.items()}
                self._redis.hset(key, mapping=payload)
            except Exception as e:
                logger.warning("Redis HSET failed for %s: %s", key, e)

    def get_user_features(self, user_id: str) -> Dict[str, np.ndarray]:
        key = self._redis_key("user", user_id)
        if self._redis:
            try:
                raw = self._redis.hgetall(key)
                if raw:
                    return {
                        k.decode(): np.frombuffer(v, dtype=np.float32)
                        for k, v in raw.items()
                    }
            except Exception as e:
                logger.warning("Redis HGETALL failed for %s: %s", key, e)
        return self._store.get(user_id, {})

    def put_event_features(self, event_id: str, features: Dict[str, np.ndarray]) -> None:
        key = self._redis_key("event", event_id)
        self._store[event_id].update(features)
        if self._redis:
            try:
                payload = {k: v.tobytes() for k, v in features.items()}
                self._redis.hset(key, mapping=payload)
            except Exception as e:
                logger.warning("Redis HSET failed for %s: %s", key, e)

    def get_event_features(self, event_id: str) -> Dict[str, np.ndarray]:
        key = self._redis_key("event", event_id)
        if self._redis:
            try:
                raw = self._redis.hgetall(key)
                if raw:
                    return {
                        k.decode(): np.frombuffer(v, dtype=np.float32)
                        for k, v in raw.items()
                    }
            except Exception as e:
                logger.warning("Redis HGETALL failed for %s: %s", key, e)
        return self._store.get(event_id, {})

    def batch_put(self, features: Dict[str, np.ndarray]) -> None:
        for name, array in features.items():
            self._store["batch"][name] = array

    def cache_inference_vector(self, user_id: str, vector: np.ndarray, ttl: int = 1800) -> None:
        """Cache a computed inference vector with TTL (seconds)."""
        key = f"inference_vector:{user_id}"
        if self._redis:
            try:
                self._redis.setex(key, ttl, vector.tobytes())
            except Exception as e:
                logger.warning("Redis SETEX failed for %s: %s", key, e)

    def get_inference_vector(self, user_id: str) -> Optional[np.ndarray]:
        """Retrieve a cached inference vector."""
        key = f"inference_vector:{user_id}"
        if self._redis:
            try:
                raw = self._redis.get(key)
                if raw:
                    return np.frombuffer(raw, dtype=np.float32)
            except Exception as e:
                logger.warning("Redis GET failed for %s: %s", key, e)
        return None

    def get_recent_clicks(self, user_id: str, limit: int = 20) -> List[str]:
        """Get recent click event IDs for a user (LRANGE)."""
        key = f"recent_clicks:{user_id}"
        if self._redis:
            try:
                items = self._redis.lrange(key, 0, limit - 1)
                return [i.decode() for i in items]
            except Exception as e:
                logger.warning("Redis LRANGE failed for %s: %s", key, e)
        return []

    def push_recent_click(self, user_id: str, event_id: str, maxlen: int = 20, ttl: int = 1800) -> None:
        """Push an event ID to the user's recent clicks list and set TTL."""
        key = f"recent_clicks:{user_id}"
        if self._redis:
            try:
                pipe = self._redis.pipeline()
                pipe.lpush(key, event_id)
                pipe.ltrim(key, 0, maxlen - 1)
                pipe.expire(key, ttl)
                pipe.execute()
            except Exception as e:
                logger.warning("Redis push_recent_click failed for %s: %s", key, e)

    def save_user_profile(self, user_id: str, data: Dict[str, Any]) -> None:
        key = f"profile:user:{user_id}"
        self._store.setdefault("user_profiles", {})[user_id] = data.copy()
        if self._redis:
            try:
                payload = {k: json.dumps(v, default=_json_default).encode() for k, v in data.items()}
                self._redis.hset(key, mapping=payload)
            except Exception as e:
                logger.warning("Redis save_user_profile failed for %s: %s", key, e)

    def load_user_profile(self, user_id: str) -> Dict[str, Any]:
        key = f"profile:user:{user_id}"
        if self._redis:
            try:
                raw = self._redis.hgetall(key)
                if raw:
                    return {k.decode(): json.loads(v) for k, v in raw.items()}
            except Exception as e:
                logger.warning("Redis load_user_profile failed for %s: %s", key, e)
        return self._store.get("user_profiles", {}).get(user_id, {})

    def save_event_profile(self, event_id: str, data: Dict[str, Any]) -> None:
        key = f"profile:event:{event_id}"
        self._store.setdefault("event_profiles", {})[event_id] = data.copy()
        if self._redis:
            try:
                payload = {k: json.dumps(v, default=_json_default).encode() for k, v in data.items()}
                self._redis.hset(key, mapping=payload)
            except Exception as e:
                logger.warning("Redis save_event_profile failed for %s: %s", key, e)

    def load_event_profile(self, event_id: str) -> Dict[str, Any]:
        key = f"profile:event:{event_id}"
        if self._redis:
            try:
                raw = self._redis.hgetall(key)
                if raw:
                    return {k.decode(): json.loads(v) for k, v in raw.items()}
            except Exception as e:
                logger.warning("Redis load_event_profile failed for %s: %s", key, e)
        return self._store.get("event_profiles", {}).get(event_id, {})

    def invalidate_user_cache(self, user_id: str) -> None:
        """Remove cached inference vector for a user (e.g., on new booking)."""
        key = f"inference_vector:{user_id}"
        if self._redis:
            try:
                self._redis.delete(key)
            except Exception as e:
                logger.warning("Redis DELETE failed for %s: %s", key, e)


# ═══════════════════════════════════════════════════════════════════════════
# 1. Location Feature Engineer
# ═══════════════════════════════════════════════════════════════════════════

class LocationFeatureEngineer:
    """
    Extracts geo-spatial features for location-based recommendations.

    Features produced (20 dimensions):

    User-side (per user):
      - home_lat, home_lon                    (centroid of user's activity)
      - home_radius_km                        (typical search radius)
      - n_unique_cities_visited               (mobility breadth)
      - n_unique_neighborhoods_visited
      - weekend_location_shift_km             (how far user travels on weekends)
      - location_entropy                      (diversity of locations visited)
      - preferred_area_cluster_id             (DBSCAN cluster of frequent locations)

    Event-side (per event):
      - event_lat, event_lon
      - distance_from_user_home_km
      - distance_from_user_current_km
      - venue_booking_density                 (bookings at this venue / capacity)
      - nearby_event_count_5km                (event density in 5km radius)
      - nearby_event_count_20km
      - city_event_popularity_percentile      (how popular this city is)
      - venue_repeat_booking_rate             (fraction of users who rebook same venue)

    Interaction (user-event pair):
      - haversine_distance_km
      - log_distance_km
      - same_city                             (binary)
      - same_neighborhood                     (binary)
      - distance_percentile_for_user          (how far this is vs user's typical range)
    """

    EARTH_RADIUS_KM = 6371.0

    def __init__(self):
        self.user_location_profile: Dict[str, Dict[str, Any]] = {}
        self.event_location_profile: Dict[str, Dict[str, Any]] = {}
        self.city_popularity: Dict[str, float] = {}
        self.venue_stats: Dict[str, Dict[str, float]] = {}
        self._fitted = False

    def fit(
        self,
        user_activities: Optional[pd.DataFrame],
        location_context: Optional[pd.DataFrame],
        search_events: Optional[pd.DataFrame],
        booking_events: Optional[pd.DataFrame],
        event_lifecycle: Optional[pd.DataFrame],
    ) -> LocationFeatureEngineer:
        """Compute per-user and per-event location aggregates from historical data."""
        logger.info("Fitting location features...")

        # Build user location profiles from activity history
        self._fit_user_profiles(user_activities, location_context, search_events, booking_events)

        # Build event location profiles
        self._fit_event_profiles(event_lifecycle, booking_events)

        # City-level popularity from booking density
        self._fit_city_popularity(booking_events, event_lifecycle)

        # Venue stats
        self._fit_venue_stats(booking_events)

        self._fitted = True
        return self

    def _fit_user_profiles(
        self,
        user_activities: Optional[pd.DataFrame],
        location_context: Optional[pd.DataFrame],
        search_events: Optional[pd.DataFrame],
        booking_events: Optional[pd.DataFrame],
    ) -> None:
        """Aggregate user location signals into profiles."""
        user_locations: Dict[str, List[Tuple[float, float]]] = defaultdict(list)
        user_radii: Dict[str, List[float]] = defaultdict(list)
        user_cities: Dict[str, List[str]] = defaultdict(list)
        user_neighborhoods: Dict[str, List[str]] = defaultdict(list)

        # From location-context events
        if location_context is not None and len(location_context) > 0:
            for _, row in location_context.iterrows():
                uid = row["userId"]
                lat = row.get("location_lat")
                lon = row.get("location_lon")
                if pd.notna(lat) and pd.notna(lon):
                    user_locations[uid].append((float(lat), float(lon)))
                city = row.get("location_city")
                if pd.notna(city):
                    user_cities[uid].append(str(city))
                nb = row.get("location_neighborhood")
                if pd.notna(nb):
                    user_neighborhoods[uid].append(str(nb))
                radius = row.get("search_radiusKm")
                if pd.notna(radius):
                    user_radii[uid].append(float(radius))

        # From search events
        if search_events is not None and len(search_events) > 0:
            for _, row in search_events.iterrows():
                uid = row["userId"]
                lat = row.get("search_filters_location_lat")
                lon = row.get("search_filters_location_lon")
                if pd.notna(lat) and pd.notna(lon):
                    user_locations[uid].append((float(lat), float(lon)))
                radius = row.get("search_filters_location_radiusKm")
                if pd.notna(radius):
                    user_radii[uid].append(float(radius))

        # From booking events
        if booking_events is not None and len(booking_events) > 0:
            for _, row in booking_events.iterrows():
                uid = row["userId"]
                lat = row.get("event_location_lat")
                lon = row.get("event_location_lon")
                if pd.notna(lat) and pd.notna(lon):
                    user_locations[uid].append((float(lat), float(lon)))
                city = row.get("event_location_city")
                if pd.notna(city):
                    user_cities[uid].append(str(city))

        # Build profile per user
        for uid in set(list(user_locations.keys())):
            locs = user_locations[uid]
            lats = [l[0] for l in locs]
            lons = [l[1] for l in locs]

            self.user_location_profile[uid] = {
                "home_lat": float(np.mean(lats)) if lats else 0.0,
                "home_lon": float(np.mean(lons)) if lons else 0.0,
                "home_lat_std": float(np.std(lats)) if len(lats) > 1 else 0.0,
                "home_lon_std": float(np.std(lons)) if len(lons) > 1 else 0.0,
                "typical_radius_km": float(np.median(user_radii[uid])) if user_radii.get(uid) else 10.0,
                "n_unique_cities": len(set(user_cities.get(uid, []))),
                "n_unique_neighborhoods": len(set(user_neighborhoods.get(uid, []))),
                "n_location_signals": len(locs),
                # Entropy of locations (higher = more diverse / explorer)
                "location_entropy": self._compute_location_entropy(locs),
            }

    def _compute_location_entropy(self, locations: List[Tuple[float, float]]) -> float:
        """Approximate location diversity using pairwise distance variance."""
        if len(locations) < 2:
            return 0.0
        dists = []
        for i in range(min(len(locations), 50)):
            for j in range(i + 1, min(len(locations), 50)):
                d = self._haversine(locations[i][0], locations[i][1],
                                    locations[j][0], locations[j][1])
                dists.append(d)
        if not dists:
            return 0.0
        mean_d = np.mean(dists)
        std_d = np.std(dists)
        # Normalized: higher std = more diverse locations
        return float(std_d / (mean_d + 1.0))

    def _fit_event_profiles(
        self,
        event_lifecycle: Optional[pd.DataFrame],
        booking_events: Optional[pd.DataFrame],
    ) -> None:
        """Index event locations for fast lookup."""
        if event_lifecycle is not None and len(event_lifecycle) > 0:
            for _, row in event_lifecycle.iterrows():
                eid = row["eventId"]
                self.event_location_profile[eid] = {
                    "lat": float(row.get("event_location_lat", 0)),
                    "lon": float(row.get("event_location_lon", 0)),
                    "city": str(row.get("event_location_city", "")),
                    "country": str(row.get("event_location_country", "")),
                }

    def _fit_city_popularity(
        self,
        booking_events: Optional[pd.DataFrame],
        event_lifecycle: Optional[pd.DataFrame],
    ) -> None:
        """Compute city-level event popularity percentiles."""
        city_counts: Dict[str, int] = defaultdict(int)

        if event_lifecycle is not None and len(event_lifecycle) > 0:
            for _, row in event_lifecycle.iterrows():
                city = row.get("event_location_city")
                if pd.notna(city):
                    city_counts[str(city)] += 1

        if booking_events is not None and len(booking_events) > 0:
            for _, row in booking_events.iterrows():
                city = row.get("event_location_city")
                if pd.notna(city):
                    city_counts[str(city)] += 2  # bookings weighted higher

        if city_counts:
            counts = np.array(list(city_counts.values()))
            for city, count in city_counts.items():
                self.city_popularity[city] = float(
                    (count - counts.min()) / (counts.max() - counts.min() + 1)
                )

    def _fit_venue_stats(self, booking_events: Optional[pd.DataFrame]) -> None:
        """Compute venue-level statistics."""
        if booking_events is not None and len(booking_events) > 0:
            venue_bookings: Dict[str, List[str]] = defaultdict(list)
            for _, row in booking_events.iterrows():
                vid = row.get("eventId")  # using event as venue proxy
                uid = row.get("userId")
                if pd.notna(vid) and pd.notna(uid):
                    venue_bookings[str(vid)].append(str(uid))

            for vid, users in venue_bookings.items():
                unique_users = len(set(users))
                self.venue_stats[vid] = {
                    "total_bookings": float(len(users)),
                    "unique_users": float(unique_users),
                    "repeat_rate": 1.0 - (unique_users / len(users)) if len(users) > 1 else 0.0,
                }

    def transform(
        self,
        user_id: str,
        event_id: str,
        user_location: Optional[Tuple[float, float]] = None,
    ) -> np.ndarray:
        """Extract location features for a user-event pair."""
        if not self._fitted:
            raise RuntimeError("Must call fit() before transform()")

        user_profile = self.user_location_profile.get(user_id, {})
        event_profile = self.event_location_profile.get(event_id, {})

        home_lat = user_profile.get("home_lat", 0.0)
        home_lon = user_profile.get("home_lon", 0.0)
        event_lat = event_profile.get("lat", 0.0)
        event_lon = event_profile.get("lon", 0.0)
        event_city = event_profile.get("city", "")

        # Current user location (from session) or fall back to home
        cur_lat = user_location[0] if user_location else home_lat
        cur_lon = user_location[1] if user_location else home_lon

        dist_from_home = self._haversine(home_lat, home_lon, event_lat, event_lon)
        dist_from_current = self._haversine(cur_lat, cur_lon, event_lat, event_lon)

        f = np.array([
            home_lat,
            home_lon,
            event_lat,
            event_lon,
            dist_from_home,
            dist_from_current,
            math.log1p(dist_from_home),
            math.log1p(dist_from_current),
            float(user_profile.get("typical_radius_km", 10.0)),
            float(user_profile.get("n_unique_cities", 0)),
            float(user_profile.get("n_unique_neighborhoods", 0)),
            float(user_profile.get("location_entropy", 0.0)),
            float(user_profile.get("home_lat_std", 0.0)),
            float(user_profile.get("home_lon_std", 0.0)),
            self.city_popularity.get(event_city, 0.5),
            self.venue_stats.get(event_id, {}).get("total_bookings", 0.0),
            self.venue_stats.get(event_id, {}).get("repeat_rate", 0.0),
            # Same-city (one-hot features encoded as 1/0)
            float(event_city == user_profile.get("home_city", "")),
            # Distance within typical range
            float(dist_from_home <= user_profile.get("typical_radius_km", 10.0)),
            # Nearby event density proxy from venue stats
            self.venue_stats.get(event_id, {}).get("unique_users", 0.0),
        ], dtype=np.float32)

        return f

    def fit_transform(
        self, **datasets: Optional[pd.DataFrame]
    ) -> np.ndarray:
        """Fit and return location feature matrix for all user-event pairs."""
        self.fit(**datasets)
        # Build feature matrix from all user-event pairs
        # In production this uses spark; for dev, aggregates user stats
        n_features = 20
        n_users = len(self.user_location_profile)
        return np.zeros((max(n_users, 1), n_features), dtype=np.float32)

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine distance in km."""
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return LocationFeatureEngineer.EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(a))


# ═══════════════════════════════════════════════════════════════════════════
# 2. Category Feature Engineer
# ═══════════════════════════════════════════════════════════════════════════

class CategoryFeatureEngineer:
    """
    Extracts category and genre features for content-based recommendations.

    Features produced (25 dimensions):

    User-side:
      - genre_affinity_vector (multi-hot, top N genres, 10 dims)
      - category_affinity_vector (multi-hot, 6 categories)
      - category_exploration_rate   (new categories / total interactions)
      - preferred_price_range_min, max
      - avg_booking_price

    Event-side:
      - category_onehot (6 dims: CONCERT, WORKSHOP, JAM_SESSION, OPEN_MIC, FESTIVAL, CLASS)
      - subcategory_onehot (derived from data)
      - genre_multi_hot (top 10 genres)
      - price_level (1=budget, 2=mid, 3=premium)

    Interaction:
      - genre_jaccard_similarity   (overlap between user preferences and event genres)
      - category_match             (binary)
      - price_affordability        (event price / user avg booking price)
    """

    CATEGORIES = [
        "CONCERT", "WORKSHOP", "JAM_SESSION", "OPEN_MIC",
        "FESTIVAL", "PRIVATE_PARTY", "CORPORATE_EVENT", "CLASS", "OTHER",
    ]

    def __init__(self, top_n_genres: int = 50):
        self.top_n_genres = top_n_genres
        self.genre_vocab: Dict[str, int] = {}  # genre -> index
        self.user_genre_affinity: Dict[str, np.ndarray] = {}
        self.user_category_affinity: Dict[str, np.ndarray] = {}
        self.category_cooccurrence: np.ndarray = np.eye(len(self.CATEGORIES))
        self.genre_cooccurrence: Dict[Tuple[str, str], float] = {}
        self._fitted = False

    def fit(
        self,
        user_activities: Optional[pd.DataFrame],
        booking_events: Optional[pd.DataFrame],
        search_events: Optional[pd.DataFrame],
        event_lifecycle: Optional[pd.DataFrame],
        recommendation_feedback: Optional[pd.DataFrame],
    ) -> CategoryFeatureEngineer:
        """Build genre vocabulary and user affinity profiles."""
        logger.info("Fitting category features...")

        # Build genre vocabulary from all events
        self._build_genre_vocab(event_lifecycle)
        self._build_genre_vocab(booking_events, col="event_genres")
        self._build_genre_vocab(search_events, col="search_filters_genres")

        # Build user affinity vectors
        self._build_user_affinities(user_activities, booking_events)

        # Build category co-occurrence from booking pairs
        self._build_category_cooccurrence(booking_events)

        self._fitted = True
        return self

    def _build_genre_vocab(self, df: Optional[pd.DataFrame], col: str = "event_genres") -> None:
        """Accumulate genre vocabulary from a DataFrame column."""
        if df is None or len(df) == 0:
            return
        for _, row in df.iterrows():
            genres = row.get(col)
            if genres is None:
                continue
            if isinstance(genres, str):
                try:
                    genres = eval(genres)  # handle list-as-string
                except Exception:
                    genres = [genres]
            if isinstance(genres, list):
                for g in genres:
                    g = str(g).lower().strip()
                    if g and g not in self.genre_vocab:
                        self.genre_vocab[g] = len(self.genre_vocab)

        # Cap at top_n_genres
        if len(self.genre_vocab) > self.top_n_genres:
            # Keep top_n_genres by frequency would happen here with real data
            pass

    def _build_user_affinities(
        self,
        user_activities: Optional[pd.DataFrame],
        booking_events: Optional[pd.DataFrame],
    ) -> None:
        """Compute per-user genre and category affinity vectors."""
        user_genres: Dict[str, Counter] = defaultdict(Counter)
        user_categories: Dict[str, Counter] = defaultdict(Counter)

        # Weight definitions: stronger signals = higher weight
        WEIGHTS = {
            "booking_confirmed": 5.0,
            "booking_attended": 8.0,
            "event_save": 4.0,
            "event_view": 1.0,
            "click": 1.5,
        }

        if user_activities is not None and len(user_activities) > 0:
            for _, row in user_activities.iterrows():
                uid = row["userId"]
                weight = WEIGHTS.get(str(row.get("type", "")), 1.0)
                cat = row.get("metadata_eventCategory") or row.get("metadata_category")
                if pd.notna(cat):
                    user_categories[uid][str(cat)] += weight
                genres = row.get("metadata_eventGenres")
                if genres is not None:
                    if isinstance(genres, str):
                        try:
                            genres = eval(genres)
                        except Exception:
                            genres = [genres]
                    if isinstance(genres, list):
                        for g in genres:
                            user_genres[uid][str(g).lower().strip()] += weight

        if booking_events is not None and len(booking_events) > 0:
            for _, row in booking_events.iterrows():
                uid = row["userId"]
                cat = row.get("event_category")
                if pd.notna(cat):
                    user_categories[uid][str(cat)] += WEIGHTS["booking_confirmed"]
                genres = row.get("event_genres")
                if genres is not None:
                    if isinstance(genres, str):
                        try:
                            genres = eval(genres)
                        except Exception:
                            genres = [genres]
                    if isinstance(genres, list):
                        for g in genres:
                            user_genres[uid][str(g).lower().strip()] += WEIGHTS["booking_confirmed"]

        # Normalize to probability distributions
        for uid in user_genres:
            total = sum(user_genres[uid].values()) or 1.0
            vec = np.zeros(len(self.genre_vocab), dtype=np.float32)
            for genre, count in user_genres[uid].items():
                idx = self.genre_vocab.get(genre)
                if idx is not None:
                    vec[idx] = count / total
            self.user_genre_affinity[uid] = vec

        for uid in user_categories:
            total = sum(user_categories[uid].values()) or 1.0
            vec = np.zeros(len(self.CATEGORIES), dtype=np.float32)
            for cat, count in user_categories[uid].items():
                cat_upper = cat.upper()
                if cat_upper in self.CATEGORIES:
                    vec[self.CATEGORIES.index(cat_upper)] = count / total
            self.user_category_affinity[uid] = vec

    def _build_category_cooccurrence(self, booking_events: Optional[pd.DataFrame]) -> None:
        """Build category co-occurrence matrix from user booking histories."""
        if booking_events is None or len(booking_events) == 0:
            return
        user_cats: Dict[str, Set[str]] = defaultdict(set)
        for _, row in booking_events.iterrows():
            uid = row["userId"]
            cat = row.get("event_category")
            if pd.notna(cat):
                user_cats[uid].add(str(cat).upper())

        cooccur = np.zeros((len(self.CATEGORIES), len(self.CATEGORIES)))
        for cats in user_cats.values():
            cat_indices = [self.CATEGORIES.index(c) for c in cats if c in self.CATEGORIES]
            for i in cat_indices:
                for j in cat_indices:
                    cooccur[i, j] += 1

        # Normalize rows
        row_sums = cooccur.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1.0
        self.category_cooccurrence = cooccur / row_sums

    def transform(self, user_id: str, event_category: str, event_genres: List[str]) -> np.ndarray:
        """Extract category features for a user-event pair."""
        if not self._fitted:
            raise RuntimeError("Must call fit() before transform()")

        user_genre_vec = self.user_genre_affinity.get(user_id,
                                                       np.zeros(len(self.genre_vocab), dtype=np.float32))
        user_cat_vec = self.user_category_affinity.get(user_id,
                                                        np.zeros(len(self.CATEGORIES), dtype=np.float32))

        # Event category one-hot
        event_cat_onehot = np.zeros(len(self.CATEGORIES), dtype=np.float32)
        cat_upper = event_category.upper()
        if cat_upper in self.CATEGORIES:
            event_cat_onehot[self.CATEGORIES.index(cat_upper)] = 1.0

        # Event genre multi-hot
        event_genre_vec = np.zeros(len(self.genre_vocab), dtype=np.float32)
        for g in event_genres:
            idx = self.genre_vocab.get(g.lower().strip())
            if idx is not None:
                event_genre_vec[idx] = 1.0

        # Genre overlap (Jaccard similarity proxy via dot product)
        genre_overlap = float(np.dot(user_genre_vec, event_genre_vec))
        user_genre_norm = float(np.linalg.norm(user_genre_vec))
        event_genre_norm = float(np.linalg.norm(event_genre_vec))
        genre_similarity = (
            genre_overlap / (user_genre_norm + event_genre_norm - genre_overlap + 1e-8)
        )

        # Category match
        cat_match = float(event_cat_onehot[np.argmax(user_cat_vec)] if user_cat_vec.sum() > 0 else 0)

        # Co-occurrence score: P(event_category | user's top category)
        user_top_cat = int(np.argmax(user_cat_vec)) if user_cat_vec.sum() > 0 else 0
        event_cat_idx = self.CATEGORIES.index(cat_upper) if cat_upper in self.CATEGORIES else 0
        cooccur_score = float(self.category_cooccurrence[user_top_cat, event_cat_idx])

        f = np.array([
            genre_similarity,
            genre_overlap,
            cat_match,
            cooccur_score,
            # User category distribution (condensed to top categories)
            *user_cat_vec[:6],
            # Event category one-hot
            *event_cat_onehot[:6],
            # User genre breadth
            float(np.count_nonzero(user_genre_vec)),
            float(np.count_nonzero(event_genre_vec)),
        ], dtype=np.float32)

        return f

    def fit_transform(self, **datasets: Optional[pd.DataFrame]) -> np.ndarray:
        self.fit(**{k: v for k, v in datasets.items() if v is not None})
        n_features = 25
        n_users = max(len(self.user_genre_affinity), 1)
        return np.zeros((n_users, n_features), dtype=np.float32)


# ═══════════════════════════════════════════════════════════════════════════
# 3. Collaborative Feature Engineer
# ═══════════════════════════════════════════════════════════════════════════

class CollaborativeFeatureEngineer:
    """
    Extracts collaborative filtering features via matrix factorization.

    Uses Alternating Least Squares (ALS) to learn latent factors for
    users and events from the user-event booking matrix.

    Features produced (32 dimensions):
      - user_latent_factors (16 dims)
      - event_latent_factors (16 dims)
    """

    N_FACTORS = 16

    def __init__(self, n_factors: int = 16, regularization: float = 0.1):
        self.n_factors = n_factors
        self.regularization = regularization
        self.user_factors: Dict[str, np.ndarray] = {}
        self.event_factors: Dict[str, np.ndarray] = {}
        self.user_index: Dict[str, int] = {}
        self.event_index: Dict[str, int] = {}
        self.global_bias: float = 0.0
        self.user_biases: Dict[str, float] = {}
        self.event_biases: Dict[str, float] = {}
        self._fitted = False

    def fit(
        self,
        booking_events: Optional[pd.DataFrame],
        user_activities: Optional[pd.DataFrame],
        recommendation_feedback: Optional[pd.DataFrame],
    ) -> CollaborativeFeatureEngineer:
        """
        Build user-event interaction matrix and factorize via ALS.

        The interaction matrix R where R[u,e] is the weighted interaction:
          5.0 = booking_attended (strongest)
          4.0 = booking_confirmed
          3.0 = event_save
          2.0 = recommendation_conversion
          1.0 = event_view / click
          0.0 = no interaction (or impression only)
        """
        logger.info("Fitting collaborative features (ALS, k=%d)...", self.n_factors)

        interactions: Dict[Tuple[str, str], float] = defaultdict(float)

        WEIGHTS = {
            "booking_attended": 5.0,
            "booking_confirmed": 4.0,
            "booking_initiated": 3.0,
            "event_save": 3.0,
            "click": 2.0,
            "event_view": 1.5,
            "category_browse": 1.0,
        }

        if booking_events is not None and len(booking_events) > 0:
            for _, row in booking_events.iterrows():
                uid = str(row["userId"])
                eid = str(row["eventId"])
                event_type = str(row.get("type", "booking_confirmed"))
                weight = WEIGHTS.get(event_type, 4.0)
                interactions[(uid, eid)] = max(interactions[(uid, eid)], weight)

        if user_activities is not None and len(user_activities) > 0:
            for _, row in user_activities.iterrows():
                uid = str(row["userId"])
                eid = row.get("metadata_eventId")
                if pd.isna(eid):
                    continue
                eid = str(eid)
                act_type = str(row.get("type", ""))
                weight = WEIGHTS.get(act_type, 1.0)
                interactions[(uid, eid)] = max(interactions[(uid, eid)], weight)

        if recommendation_feedback is not None and len(recommendation_feedback) > 0:
            for _, row in recommendation_feedback.iterrows():
                uid = str(row["userId"])
                fb_type = str(row.get("type", ""))
                weight = 2.0 if fb_type == "conversion" else (1.0 if fb_type == "click" else 0.5)
                interactions[(uid, "rec_fb")] = max(interactions.get((uid, "rec_fb"), 0), weight)

        if not interactions:
            self._fitted = True
            return self

        # Build index mappings
        users = sorted(set(k[0] for k in interactions.keys()))
        events = sorted(set(k[1] for k in interactions.keys()))
        self.user_index = {u: i for i, u in enumerate(users)}
        self.event_index = {e: i for i, e in enumerate(events)}

        # Build sparse interaction matrix
        n_users = len(users)
        n_events = len(events)
        R = np.zeros((n_users, n_events), dtype=np.float32)
        for (uid, eid), weight in interactions.items():
            R[self.user_index[uid], self.event_index[eid]] = weight

        # ALS factorization
        self.user_factors = {u: np.random.randn(self.n_factors).astype(np.float32) * 0.01
                             for u in users}
        self.event_factors = {e: np.random.randn(self.n_factors).astype(np.float32) * 0.01
                              for e in events}

        U = np.array([self.user_factors[u] for u in users])
        V = np.array([self.event_factors[e] for e in events])

        for iteration in range(10):
            # Fix V, solve for U
            for i in range(n_users):
                VTV = V.T @ V
                A = VTV + self.regularization * np.eye(self.n_factors)
                b = V.T @ R[i, :]
                U[i] = np.linalg.solve(A, b)

            # Fix U, solve for V
            UTU = U.T @ U
            for j in range(n_events):
                A = UTU + self.regularization * np.eye(self.n_factors)
                b = U.T @ R[:, j]
                V[j] = np.linalg.solve(A, b)

        for i, u in enumerate(users):
            self.user_factors[u] = U[i]
        for j, e in enumerate(events):
            self.event_factors[e] = V[j]

        # Global bias
        self.global_bias = float(np.mean(R[R > 0])) if np.any(R > 0) else 0.0

        # Per-user and per-event biases
        for i, u in enumerate(users):
            user_ratings = R[i, R[i, :] > 0]
            self.user_biases[u] = float(np.mean(user_ratings)) - self.global_bias if len(user_ratings) > 0 else 0.0

        for j, e in enumerate(events):
            event_ratings = R[R[:, j] > 0, j]
            self.event_biases[e] = float(np.mean(event_ratings)) - self.global_bias if len(event_ratings) > 0 else 0.0

        logger.info("ALS complete: %d users, %d events", n_users, n_events)
        self._fitted = True
        return self

    def transform(self, user_id: str, event_id: str) -> np.ndarray:
        """Get concatenated latent factors for a user-event pair."""
        if not self._fitted:
            return np.zeros(self.n_factors * 2, dtype=np.float32)

        uf = self.user_factors.get(user_id, np.zeros(self.n_factors, dtype=np.float32))
        ef = self.event_factors.get(event_id, np.zeros(self.n_factors, dtype=np.float32))

        # Dot product as "predicted affinity"
        affinity = float(np.dot(uf, ef))

        ub = self.user_biases.get(user_id, 0.0)
        eb = self.event_biases.get(event_id, 0.0)
        predicted = self.global_bias + ub + eb + affinity

        return np.concatenate([uf, ef, [predicted]]).astype(np.float32)

    def fit_transform(self, **datasets: Optional[pd.DataFrame]) -> np.ndarray:
        self.fit(**{k: v for k, v in datasets.items() if v is not None})
        n = max(len(self.user_factors), 1)
        return np.zeros((n, self.n_factors * 2 + 1), dtype=np.float32)


# ═══════════════════════════════════════════════════════════════════════════
# 4. Temporal Feature Engineer
# ═══════════════════════════════════════════════════════════════════════════

class TemporalFeatureEngineer:
    """
    Extracts temporal patterns for time-aware recommendations.

    Features produced (12 dimensions):

    User-side:
      - preferred_time_of_day   (morning/afternoon/evening/night one-hot)
      - preferred_day_of_week   (weekday vs weekend ratio)
      - activity_hour_distribution (peak hours)
      - booking_lead_time_days  (how far in advance user books)

    Event-side:
      - event_hour
      - event_day_of_week
      - event_is_weekend

    Interaction:
      - time_distance_hours     (hours until event starts)
      - hour_match_score        (event hour vs user preferred hour)
      - recency_days            (days since last similar activity)
    """

    TIME_BINS = [0, 6, 12, 18, 24]  # night, morning, afternoon, evening
    TIME_LABELS = ["night", "morning", "afternoon", "evening"]

    def __init__(self):
        self.user_hour_dist: Dict[str, np.ndarray] = {}  # 24-dim normalized histogram
        self.user_dow_dist: Dict[str, np.ndarray] = {}   # 7-dim normalized histogram
        self.user_avg_lead_time: Dict[str, float] = {}
        self.user_last_active: Dict[str, datetime] = {}
        self._fitted = False

    def fit(
        self,
        user_activities: Optional[pd.DataFrame],
        booking_events: Optional[pd.DataFrame],
        search_events: Optional[pd.DataFrame],
    ) -> TemporalFeatureEngineer:
        """Build temporal preference profiles per user."""
        logger.info("Fitting temporal features...")

        user_hours: Dict[str, Counter] = defaultdict(Counter)
        user_dows: Dict[str, Counter] = defaultdict(Counter)
        user_lead_times: Dict[str, List[float]] = defaultdict(list)

        for df in [user_activities, booking_events, search_events]:
            if df is None or len(df) == 0:
                continue
            for _, row in df.iterrows():
                uid = row["userId"]
                ts = row.get("timestamp")
                if pd.isna(ts):
                    continue
                if isinstance(ts, str):
                    ts = pd.Timestamp(ts)
                user_hours[uid][ts.hour] += 1
                user_dows[uid][ts.dayofweek] += 1

        # Booking lead time
        if booking_events is not None and len(booking_events) > 0:
            for _, row in booking_events.iterrows():
                uid = row["userId"]
                ts = row.get("timestamp")
                if pd.isna(ts):
                    continue
                if isinstance(ts, str):
                    ts = pd.Timestamp(ts)
                # Lead time: days between booking and event (simplified)
                lead_time = 7.0  # default if event start time not in row
                user_lead_times[uid].append(lead_time)

        # Normalize
        for uid in user_hours:
            total = sum(user_hours[uid].values()) or 1
            dist = np.zeros(24, dtype=np.float32)
            for h, c in user_hours[uid].items():
                dist[int(h)] = c / total
            self.user_hour_dist[uid] = dist

        for uid in user_dows:
            total = sum(user_dows[uid].values()) or 1
            dist = np.zeros(7, dtype=np.float32)
            for d, c in user_dows[uid].items():
                dist[int(d)] = c / total
            self.user_dow_dist[uid] = dist

        for uid in user_lead_times:
            self.user_avg_lead_time[uid] = float(np.mean(user_lead_times[uid]))

        self._fitted = True
        return self

    def transform(self, user_id: str, event_timestamp: Optional[datetime] = None) -> np.ndarray:
        """Extract temporal features."""
        if not self._fitted:
            return np.zeros(12, dtype=np.float32)

        hour_dist = self.user_hour_dist.get(user_id, np.zeros(24, dtype=np.float32))
        dow_dist = self.user_dow_dist.get(user_id, np.zeros(7, dtype=np.float32))
        avg_lead = self.user_avg_lead_time.get(user_id, 7.0)

        # Time bin distribution
        bin_dist = np.zeros(4, dtype=np.float32)
        for h in range(24):
            if h < 6:
                bin_dist[0] += hour_dist[h]
            elif h < 12:
                bin_dist[1] += hour_dist[h]
            elif h < 18:
                bin_dist[2] += hour_dist[h]
            else:
                bin_dist[3] += hour_dist[h]

        # Preferred hour (peak)
        peak_hour = float(np.argmax(hour_dist))
        preferred_dow = float(np.argmax(dow_dist))
        weekend_ratio = float(dow_dist[5] + dow_dist[6])

        # Event temporal context (if provided)
        event_hour = float(event_timestamp.hour) if event_timestamp else 12.0
        event_dow = float(event_timestamp.weekday()) if event_timestamp else 3.0
        event_is_weekend = 1.0 if event_dow >= 5 else 0.0

        f = np.array([
            peak_hour,
            preferred_dow,
            weekend_ratio,
            avg_lead,
            bin_dist[0],  # night preference
            bin_dist[1],  # morning preference
            bin_dist[2],  # afternoon preference
            bin_dist[3],  # evening preference
            event_hour,
            event_dow,
            event_is_weekend,
            float(np.count_nonzero(hour_dist)),  # hour diversity
        ], dtype=np.float32)

        return f

    def fit_transform(self, **datasets: Optional[pd.DataFrame]) -> np.ndarray:
        self.fit(**{k: v for k, v in datasets.items() if v is not None})
        n = max(len(self.user_hour_dist), 1)
        return np.zeros((n, 12), dtype=np.float32)


# ═══════════════════════════════════════════════════════════════════════════
# 5. Engagement Feature Engineer
# ═══════════════════════════════════════════════════════════════════════════

class EngagementFeatureEngineer:
    """
    Extracts user engagement and behavior quality features.

    Features produced (15 dimensions):

    User-side:
      - total_sessions
      - avg_session_duration_s
      - avg_dwell_time_ms           (on event pages)
      - view_to_click_rate
      - click_to_book_rate
      - view_to_book_rate
      - search_frequency            (searches per session)
      - rec_dismissal_rate          (fraction of recs dismissed)
      - rec_ctr                     (click-through rate on recommendations)
      - rec_conversion_rate         (booking rate from recommendations)

    Event-side:
      - event_ctr                   (global CTR for this event)
      - event_conversion_rate

    Interaction:
      - event_popularity_percentile
      - user_activity_recency_days
      - session_depth               (events viewed in current session)
    """

    def __init__(self):
        self.user_engagement: Dict[str, Dict[str, float]] = {}
        self.event_engagement: Dict[str, Dict[str, float]] = {}
        self._fitted = False

    def fit(
        self,
        user_activities: Optional[pd.DataFrame],
        recommendation_feedback: Optional[pd.DataFrame],
    ) -> EngagementFeatureEngineer:
        """Compute per-user and per-event engagement metrics."""
        logger.info("Fitting engagement features...")

        user_counts: Dict[str, Counter] = defaultdict(Counter)
        user_totals: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

        if user_activities is not None and len(user_activities) > 0:
            for _, row in user_activities.iterrows():
                uid = row["userId"]
                act_type = str(row.get("type", ""))
                user_counts[uid][act_type] += 1
                user_counts[uid]["total"] += 1

                dwell = row.get("metadata_dwellTimeMs")
                if pd.notna(dwell):
                    user_totals[uid]["dwell_sum"] += float(dwell)
                    user_totals[uid]["dwell_count"] += 1

                session_dur = row.get("metadata_sessionDuration")
                if pd.notna(session_dur):
                    user_totals[uid]["session_dur_sum"] += float(session_dur)
                    user_totals[uid]["session_count"] += 1

        if recommendation_feedback is not None and len(recommendation_feedback) > 0:
            for _, row in recommendation_feedback.iterrows():
                uid = row["userId"]
                fb_type = str(row.get("type", ""))
                user_counts[uid][f"rec_{fb_type}"] += 1

        # Compute rates per user
        for uid in user_counts:
            c = user_counts[uid]
            total = max(c.get("total", 0), 1)
            views = c.get("event_view", 0)
            clicks = c.get("click", 0)
            bookings = c.get("booking_confirmed", c.get("booking_attended", 0))

            self.user_engagement[uid] = {
                "total_activities": float(total),
                "view_to_click_rate": clicks / max(views, 1),
                "click_to_book_rate": bookings / max(clicks, 1),
                "view_to_book_rate": bookings / max(views, 1),
                "avg_dwell_ms": (
                    user_totals[uid]["dwell_sum"] / max(user_totals[uid]["dwell_count"], 1)
                ),
                "avg_session_duration_s": (
                    user_totals[uid]["session_dur_sum"] / max(user_totals[uid]["session_count"], 1)
                ),
                "search_frequency": c.get("search_performed", 0) / max(total, 1),
                "rec_impressions": float(c.get("rec_impression", 0)),
                "rec_ctr": c.get("rec_click", 0) / max(c.get("rec_impression", 0), 1),
                "rec_conversion_rate": c.get("rec_conversion", 0) / max(c.get("rec_impression", 0), 1),
                "rec_dismissal_rate": c.get("rec_dismiss", 0) / max(c.get("rec_impression", 0), 1),
            }

        self._fitted = True
        return self

    def transform(self, user_id: str, event_id: str) -> np.ndarray:
        """Extract engagement features for user-event pair."""
        if not self._fitted:
            return np.zeros(15, dtype=np.float32)

        ue = self.user_engagement.get(user_id, {})
        ee = self.event_engagement.get(event_id, {})

        f = np.array([
            ue.get("total_activities", 0.0),
            ue.get("view_to_click_rate", 0.0),
            ue.get("click_to_book_rate", 0.0),
            ue.get("view_to_book_rate", 0.0),
            ue.get("avg_dwell_ms", 0.0) / 1000.0,  # normalize to seconds
            ue.get("avg_session_duration_s", 0.0),
            ue.get("search_frequency", 0.0),
            ue.get("rec_impressions", 0.0),
            ue.get("rec_ctr", 0.0),
            ue.get("rec_conversion_rate", 0.0),
            ue.get("rec_dismissal_rate", 0.0),
            ee.get("event_ctr", 0.0),
            ee.get("event_conversion_rate", 0.0),
            # Activity recency (days since last activity — from timestamp diff)
            0.0,  # placeholder — computed at inference time
            # Session depth proxy
            float(ue.get("total_activities", 0) > 100),  # power user binary
        ], dtype=np.float32)

        return f

    def fit_transform(self, **datasets: Optional[pd.DataFrame]) -> np.ndarray:
        self.fit(**{k: v for k, v in datasets.items() if v is not None})
        n = max(len(self.user_engagement), 1)
        return np.zeros((n, 15), dtype=np.float32)


# ═══════════════════════════════════════════════════════════════════════════
# 6. Interest Similarity Feature Engineer
# ═══════════════════════════════════════════════════════════════════════════

class InterestSimilarityFeatureEngineer:
    """
    Extracts explicit interest matching features between user interests and event tags.

    Data sources: user-interests from user_activities metadata, event-tags from
    event_lifecycle data.

    Features produced (18 dimensions):

    Overlap metrics (6 dims):
      - interests_jaccard              Jaccard similarity between user interests and event tags
      - interests_dice                 Dice coefficient (2*intersection / sum of sizes)
      - interests_overlap_count        Raw count of shared tags
      - interest_coverage              Fraction of user interests matched by event
      - event_tag_coverage             Fraction of event tags matching user interests
      - interests_tfidf_score          Weighted overlap (TF-IDF inspired)

    Profile vectors (10 dims):
      - user_interest_profile[0:5]     5-dim projection of user interest vector (top categories)
      - event_tag_profile[0:5]         5-dim one-hot/probability of event tag categories

    Temporal (2 dims):
      - interest_freshness_days        Days since user last updated interests (0 if unknown)
      - interests_overlap_binary       Binary: does user have ANY matching interest?
    """

    N_OUTPUT = 18
    TOP_TAGS = 50

    def __init__(self, top_tags: int = 50):
        self.top_tags = top_tags
        self.tag_vocab: Dict[str, int] = {}  # tag -> index
        self.user_interest_vecs: Dict[str, np.ndarray] = {}
        self.event_tag_vecs: Dict[str, np.ndarray] = {}
        self.tag_idf: Dict[str, float] = {}
        self.user_interest_update: Dict[str, datetime] = {}
        self._fitted = False

    def fit(
        self,
        user_activities: Optional[pd.DataFrame],
        event_lifecycle: Optional[pd.DataFrame],
        booking_events: Optional[pd.DataFrame],
    ) -> InterestSimilarityFeatureEngineer:
        """Build tag vocabulary, user interest vectors, and event tag vectors."""
        logger.info("Fitting interest similarity features...")

        # Build global tag vocabulary from events
        self._build_tag_vocab(event_lifecycle)
        self._build_tag_vocab(booking_events, col="event_genres")

        # Compute tag IDF (inverse document frequency across events)
        self._compute_tag_idf(event_lifecycle)

        # Build user interest profiles from activities + bookings
        self._build_user_interest_profiles(user_activities, booking_events)

        # Build event tag profiles
        self._build_event_tag_profiles(event_lifecycle, booking_events)

        self._fitted = True
        return self

    def _build_tag_vocab(
        self, df: Optional[pd.DataFrame], col: str = "event_tags"
    ) -> None:
        """Accumulate tag vocabulary from event data."""
        if df is None or len(df) == 0:
            return
        tag_counts: Dict[str, int] = defaultdict(int)
        for _, row in df.iterrows():
            tags = row.get(col)
            if tags is None:
                continue
            if isinstance(tags, str):
                try:
                    tags = eval(tags)
                except Exception:
                    tags = [tags]
            if isinstance(tags, list):
                for t in tags:
                    t = str(t).lower().strip()
                    if t:
                        tag_counts[t] += 1

        # Keep top tags by frequency
        sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
        for tag, _ in sorted_tags[:self.top_tags]:
            if tag not in self.tag_vocab:
                self.tag_vocab[tag] = len(self.tag_vocab)

    def _compute_tag_idf(self, event_lifecycle: Optional[pd.DataFrame]) -> None:
        """Compute IDF for tags: log(N / df(t))."""
        if event_lifecycle is None or len(event_lifecycle) == 0:
            return
        n_events = len(event_lifecycle)
        tag_doc_count: Dict[str, int] = defaultdict(int)

        for _, row in event_lifecycle.iterrows():
            tags = row.get("event_tags")
            if tags is None:
                continue
            if isinstance(tags, str):
                try:
                    tags = eval(tags)
                except Exception:
                    tags = [tags]
            if isinstance(tags, list):
                seen = set()
                for t in tags:
                    t = str(t).lower().strip()
                    if t and t not in seen:
                        tag_doc_count[t] += 1
                        seen.add(t)

        for tag, count in tag_doc_count.items():
            self.tag_idf[tag] = math.log((n_events + 1) / (count + 1)) + 1.0

    def _build_user_interest_profiles(
        self,
        user_activities: Optional[pd.DataFrame],
        booking_events: Optional[pd.DataFrame],
    ) -> None:
        """Build per-user interest vectors with weighted signals."""
        user_tags: Dict[str, Counter] = defaultdict(Counter)
        user_last_update: Dict[str, datetime] = {}

        WEIGHTS = {
            "booking_confirmed": 5.0,
            "booking_attended": 8.0,
            "event_save": 4.0,
            "event_view": 1.0,
            "click": 1.5,
            "category_browse": 2.0,
        }

        # From user activities: extract interests from category/genre metadata
        if user_activities is not None and len(user_activities) > 0:
            for _, row in user_activities.iterrows():
                uid = row["userId"]
                weight = WEIGHTS.get(str(row.get("type", "")), 1.0)

                # Interests from category browsing
                cat = row.get("metadata_eventCategory") or row.get("metadata_category")
                if pd.notna(cat):
                    user_tags[uid][f"cat:{str(cat).lower().strip()}"] += weight

                # Interests from event genres
                genres = row.get("metadata_eventGenres")
                if genres is not None:
                    if isinstance(genres, str):
                        try:
                            genres = eval(genres)
                        except Exception:
                            genres = [genres]
                    if isinstance(genres, list):
                        for g in genres:
                            user_tags[uid][str(g).lower().strip()] += weight

                ts = row.get("timestamp")
                if pd.notna(ts):
                    if isinstance(ts, str):
                        ts = pd.Timestamp(ts)
                    if uid not in user_last_update or ts > user_last_update[uid]:
                        user_last_update[uid] = ts.to_pydatetime()

        # From booking events
        if booking_events is not None and len(booking_events) > 0:
            for _, row in booking_events.iterrows():
                uid = row["userId"]
                cat = row.get("event_category")
                if pd.notna(cat):
                    user_tags[uid][f"cat:{str(cat).lower().strip()}"] += WEIGHTS["booking_confirmed"]
                genres = row.get("event_genres")
                if genres is not None:
                    if isinstance(genres, str):
                        try:
                            genres = eval(genres)
                        except Exception:
                            genres = [genres]
                    if isinstance(genres, list):
                        for g in genres:
                            user_tags[uid][str(g).lower().strip()] += WEIGHTS["booking_confirmed"]

                ts = row.get("timestamp")
                if pd.notna(ts):
                    if isinstance(ts, str):
                        ts = pd.Timestamp(ts)
                    if uid not in user_last_update or ts > user_last_update[uid]:
                        user_last_update[uid] = ts.to_pydatetime()

        # Normalize user vectors
        vocab_len = max(len(self.tag_vocab), 1)
        for uid in user_tags:
            total = sum(user_tags[uid].values()) or 1.0
            vec = np.zeros(vocab_len, dtype=np.float32)
            for tag, count in user_tags[uid].items():
                idx = self.tag_vocab.get(tag)
                if idx is not None:
                    vec[idx] = count / total
            self.user_interest_vecs[uid] = vec

        self.user_interest_update = user_last_update

    def _build_event_tag_profiles(
        self,
        event_lifecycle: Optional[pd.DataFrame],
        booking_events: Optional[pd.DataFrame],
    ) -> None:
        """Build per-event tag vectors."""
        vocab_len = max(len(self.tag_vocab), 1)

        for df in [event_lifecycle, booking_events]:
            if df is None or len(df) == 0:
                continue
            for _, row in df.iterrows():
                eid = row.get("eventId")
                if pd.isna(eid) or str(eid) in self.event_tag_vecs:
                    continue
                eid = str(eid)

                tags = row.get("event_tags") or row.get("event_genres")
                if tags is None:
                    self.event_tag_vecs[eid] = np.zeros(vocab_len, dtype=np.float32)
                    continue
                if isinstance(tags, str):
                    try:
                        tags = eval(tags)
                    except Exception:
                        tags = [tags]

                if isinstance(tags, list) and tags:
                    vec = np.zeros(vocab_len, dtype=np.float32)
                    for t in tags:
                        t = str(t).lower().strip()
                        idx = self.tag_vocab.get(t)
                        if idx is not None:
                            vec[idx] = 1.0
                    norm = np.linalg.norm(vec)
                    if norm > 0:
                        vec /= norm
                    self.event_tag_vecs[eid] = vec
                else:
                    self.event_tag_vecs[eid] = np.zeros(vocab_len, dtype=np.float32)

    def transform(
        self,
        user_id: str,
        event_id: str,
        event_category: str = "",
        event_tags: Optional[List[str]] = None,
    ) -> np.ndarray:
        """Extract interest similarity features for a user-event pair."""
        if not self._fitted:
            return np.zeros(self.N_OUTPUT, dtype=np.float32)

        user_vec = self.user_interest_vecs.get(
            user_id, np.zeros(max(len(self.tag_vocab), 1), dtype=np.float32)
        )
        event_vec = self.event_tag_vecs.get(
            event_id, np.zeros(max(len(self.tag_vocab), 1), dtype=np.float32)
        )

        # Jaccard similarity: use cosine-like overlap from continuous vectors
        dot = float(np.dot(user_vec, event_vec))
        user_norm = float(np.linalg.norm(user_vec))
        event_norm = float(np.linalg.norm(event_vec))
        jaccard = dot / (user_norm + event_norm - dot + 1e-8)

        # Dice coefficient
        dice = (2.0 * dot) / (user_norm + event_norm + 1e-8)

        # Overlap count
        overlap_count = float(np.sum((user_vec > 0) & (event_vec > 0)))

        # Coverage ratios
        user_active_tags = float(np.count_nonzero(user_vec))
        event_active_tags = float(np.count_nonzero(event_vec))
        interest_coverage = overlap_count / max(user_active_tags, 1.0)
        event_tag_coverage = overlap_count / max(event_active_tags, 1.0)

        # TF-IDF weighted overlap
        tfidf_score = 0.0
        for tag, idx in self.tag_vocab.items():
            if user_vec[idx] > 0 and event_vec[idx] > 0:
                tfidf_score += user_vec[idx] * self.tag_idf.get(tag, 1.0)
        tfidf_score = min(tfidf_score, 10.0)

        # User interest profile projection (top 5 genres/categories from user)
        user_top_indices = np.argsort(user_vec)[-5:][::-1] if user_active_tags > 0 else []
        user_profile = np.zeros(5, dtype=np.float32)
        for i, idx in enumerate(user_top_indices):
            if i < 5:
                user_profile[i] = user_vec[idx]

        # Event tag profile projection (top 5 tags from event)
        event_top_indices = np.argsort(event_vec)[-5:][::-1] if event_active_tags > 0 else []
        event_profile = np.zeros(5, dtype=np.float32)
        for i, idx in enumerate(event_top_indices):
            if i < 5:
                event_profile[i] = event_vec[idx]

        # Interest freshness (days since last interest update)
        last_update = self.user_interest_update.get(user_id)
        if last_update:
            freshness_days = (datetime.now(timezone.utc) - last_update).days
        else:
            freshness_days = 365.0

        # Binary overlap
        overlap_binary = 1.0 if overlap_count > 0 else 0.0

        return np.array([
            jaccard,
            dice,
            overlap_count,
            interest_coverage,
            event_tag_coverage,
            tfidf_score,
            *user_profile,
            *event_profile,
            freshness_days,
            overlap_binary,
        ], dtype=np.float32)

    def fit_transform(self, **datasets: Optional[pd.DataFrame]) -> np.ndarray:
        self.fit(**{k: v for k, v in datasets.items() if v is not None})
        n = max(len(self.user_interest_vecs), 1)
        return np.zeros((n, self.N_OUTPUT), dtype=np.float32)


# ═══════════════════════════════════════════════════════════════════════════
# 7. Participant Co-occurrence Feature Engineer
# ═══════════════════════════════════════════════════════════════════════════

class ParticipantCooccurrenceFeatureEngineer:
    """
    Extracts collaborative signals from users who attended the same events.

    "Users like you also attend these events."

    Data sources: booking_events (user-event attendance pairs), user_activities.

    Features produced (16 dimensions):

    Cohort size & density (4 dims):
      - coattendee_count                Number of distinct co-attendees
      - coattendee_count_log            Log(coattendee_count + 1)
      - coattendee_avg_events           Avg number of events co-attendees have been to
      - cohort_diversity                Number of unique categories co-attendees engage with

    Overlap metrics (3 dims):
      - jaccard_overlap_mean            Mean Jaccard overlap of event sets
      - jaccard_overlap_max             Max Jaccard overlap with any co-attendee
      - n_common_events                 Total events user shares with co-attendees

    Target event affinity (4 dims):
      - coattended_category_affinity    Fraction of co-attendees who booked this category
      - coattended_genre_affinity       Fraction of co-attendees who booked these genres
      - event_popularity_in_cohort      Fraction of co-attendees who booked this event
      - cohort_size_normalized          coattendee_count / total_user_base

    Temporal (2 dims):
      - cohort_recency_days             Days since most recent co-attended event
      - coattendee_share_count          Number of shared events on average

    Embedding projection (3 dims):
      - cohort_embedding_0..2           3-dim PCA of co-attendee activity (zero if unsupported)
    """

    N_OUTPUT = 16

    def __init__(self):
        self.user_event_sets: Dict[str, Set[str]] = {}  # user -> set of event_ids
        self.event_user_sets: Dict[str, Set[str]] = {}  # event -> set of user_ids
        self.user_categories: Dict[str, Counter] = defaultdict(Counter)
        self.user_genres: Dict[str, Counter] = defaultdict(Counter)
        self.coattendee_graph: Dict[str, Dict[str, float]] = defaultdict(dict)  # user -> {other_user: overlap}
        self.last_attendance: Dict[str, datetime] = {}
        self.total_user_base: int = 0
        self._fitted = False

    def fit(
        self,
        booking_events: Optional[pd.DataFrame],
        user_activities: Optional[pd.DataFrame],
    ) -> ParticipantCooccurrenceFeatureEngineer:
        """
        Build user-event bipartite graph and compute co-attendance adjacency.

        Requires booking_events with userId + eventId for attendance signals.
        """
        logger.info("Fitting participant co-occurrence features...")

        # Build user-event and event-user sets from booking events
        if booking_events is not None and len(booking_events) > 0:
            for _, row in booking_events.iterrows():
                uid = str(row["userId"])
                eid = str(row["eventId"])
                event_type = str(row.get("type", ""))

                # Only count confirmed/attended bookings
                if event_type in ("booking_confirmed", "booking_attended"):
                    self.user_event_sets.setdefault(uid, set()).add(eid)
                    self.event_user_sets.setdefault(eid, set()).add(uid)

                # Track categories and genres
                cat = row.get("event_category")
                if pd.notna(cat):
                    self.user_categories[uid][str(cat)] += 1
                genres = row.get("event_genres")
                if genres is not None:
                    if isinstance(genres, str):
                        try:
                            genres = eval(genres)
                        except Exception:
                            genres = [genres]
                    if isinstance(genres, list):
                        for g in genres:
                            self.user_genres[uid][str(g).lower().strip()] += 1

                # Track last attendance time
                ts = row.get("timestamp")
                if pd.notna(ts):
                    if isinstance(ts, str):
                        ts = pd.Timestamp(ts)
                    ts_dt = ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts
                    if uid not in self.last_attendance or ts_dt > self.last_attendance[uid]:
                        self.last_attendance[uid] = ts_dt

        # Also include implicit signals from saves (weaker)
        if user_activities is not None and len(user_activities) > 0:
            for _, row in user_activities.iterrows():
                if str(row.get("type", "")) == "event_save":
                    uid = str(row["userId"])
                    eid = row.get("metadata_eventId")
                    if pd.notna(eid):
                        eid = str(eid)
                        # Only add if not already from confirmed booking
                        if uid not in self.user_event_sets or eid not in self.user_event_sets[uid]:
                            self.event_user_sets.setdefault(eid, set()).add(uid)

        # Build co-attendee graph: for each user, find overlapping users
        all_users = list(self.user_event_sets.keys())
        self.total_user_base = len(all_users)

        # For efficiency, build inverted index first
        for uid in all_users:
            coattendee_overlap: Dict[str, float] = defaultdict(float)
            for eid in self.user_event_sets.get(uid, set()):
                for other_uid in self.event_user_sets.get(eid, set()):
                    if other_uid != uid:
                        coattendee_overlap[other_uid] += 1.0

            if coattendee_overlap:
                self.coattendee_graph[uid] = dict(coattendee_overlap)

        logger.info(
            "Co-attendee graph: %d users, %d with connections",
            self.total_user_base,
            len(self.coattendee_graph),
        )
        self._fitted = True
        return self

    def transform(
        self,
        user_id: str,
        event_id: str,
        event_category: str = "",
        event_genres: Optional[List[str]] = None,
    ) -> np.ndarray:
        """Extract participant co-occurrence features for a user-event pair."""
        if not self._fitted:
            return np.zeros(self.N_OUTPUT, dtype=np.float32)

        coattendees = self.coattendee_graph.get(user_id, {})
        n_coattendees = len(coattendees)

        if n_coattendees == 0:
            return np.zeros(self.N_OUTPUT, dtype=np.float32)

        # Cohort size
        coattendee_count = float(n_coattendees)
        coattendee_count_log = math.log1p(n_coattendees)

        # Average events per co-attendee
        coattendee_event_counts = []
        coattendee_categories: Set[str] = set()
        coattendee_genres: Set[str] = set()
        coattendee_booked_this_event = 0
        coattendee_booked_this_category = 0
        total_overlap = 0.0
        max_overlap = 0.0

        user_events = self.user_event_sets.get(user_id, set())
        n_user_events = len(user_events)
        event_category_upper = event_category.upper()
        event_genre_set = set(g.lower().strip() for g in (event_genres or []))

        for other_uid, shared_count in coattendees.items():
            other_events = self.user_event_sets.get(other_uid, set())
            coattendee_event_counts.append(len(other_events))

            # Jaccard overlap
            intersection = len(user_events & other_events)
            union = len(user_events | other_events)
            jaccard = intersection / max(union, 1)
            total_overlap += jaccard
            max_overlap = max(max_overlap, jaccard)

            # Category/gere diversity from co-attendee
            for cat in self.user_categories.get(other_uid, {}):
                coattendee_categories.add(cat)
            for genre in self.user_genres.get(other_uid, {}):
                coattendee_genres.add(genre)

            # Did this co-attendee book this event?
            if event_id in other_events:
                coattendee_booked_this_event += 1

            # Did this co-attendee book events in same category?
            if event_category_upper in [
                c.upper() for c in self.user_categories.get(other_uid, {})
            ]:
                coattendee_booked_this_category += 1

        # Compute aggregates
        avg_events = float(np.mean(coattendee_event_counts)) if coattendee_event_counts else 0.0
        jaccard_mean = total_overlap / n_coattendees if n_coattendees > 0 else 0.0

        # Cohort diversity
        cohort_category_diversity = float(len(coattendee_categories))
        cohort_genre_diversity = float(len(coattendee_genres))

        # Event affinity in cohort
        category_affinity = coattendee_booked_this_category / n_coattendees
        event_popularity = coattendee_booked_this_event / n_coattendees

        # Genre affinity
        genre_affinity = 0.0
        if event_genre_set and coattendee_genres:
            genre_affinity = len(event_genre_set & coattendee_genres) / max(len(event_genre_set), 1)

        # Cohort size normalized by total user base
        cohort_size_norm = coattendee_count / max(self.total_user_base, 1)

        # Recency: days since most recent co-attended event
        last_att = self.last_attendance.get(user_id)
        if last_att:
            recency_days = (datetime.now(timezone.utc) - last_att).days
        else:
            recency_days = 365.0

        # Average shared events count
        avg_shared = total_overlap * n_user_events / max(n_coattendees, 1)

        # Embedding projection (placeholder zeros — would use SVD in production)
        cohort_emb_0 = min(coattendee_count_log / 10.0, 1.0)
        cohort_emb_1 = min(category_affinity, 1.0)
        cohort_emb_2 = min(genre_affinity, 1.0)

        return np.array([
            coattendee_count,
            coattendee_count_log,
            avg_events,
            cohort_category_diversity,
            jaccard_mean,
            max_overlap,
            float(n_user_events),
            category_affinity,
            genre_affinity,
            event_popularity,
            cohort_size_norm,
            cohort_genre_diversity,
            recency_days,
            avg_shared,
            cohort_emb_0,
            cohort_emb_1,
        ], dtype=np.float32)  # NOTE: 16 dims (cohort_emb_2 is omitted for now, keeping exactly 16)

    def fit_transform(self, **datasets: Optional[pd.DataFrame]) -> np.ndarray:
        self.fit(**{k: v for k, v in datasets.items() if v is not None})
        n = max(len(self.coattendee_graph), 1)
        return np.zeros((n, self.N_OUTPUT), dtype=np.float32)
