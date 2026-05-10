#!/usr/bin/env python3
"""
Candidate generation for event recommendations.

Uses pgvector for ANN retrieval via cosine distance with metadata filters
(geo bounding-box, category, genre, price) applied directly in SQL WHERE
clauses on the jsonb metadata column.

Falls back to in-memory brute-force scoring when pgvector is unavailable.
"""

from __future__ import annotations

import json
import logging
import math
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("candidate-generator")


def _to_vector_str(arr: np.ndarray) -> str:
    """Format a numpy array as a pgvector-compatible string: [v1,v2,...,vn]."""
    return "[" + ",".join(f"{x:.10f}" for x in arr) + "]"


def _parse_vector_str(s: str) -> np.ndarray:
    """Parse a pgvector string representation back to numpy array."""
    return np.array([float(x) for x in s.strip("[]").split(",")], dtype=np.float32)


class CandidateGenerator:
    """
    Generates candidate events for the ranking pipeline.

    Primary path: Query pgvector with cosine distance + SQL metadata filters.
    Fallback path: In-memory brute-force dot product (dev/test without pgvector).
    """

    EARTH_RADIUS_KM = 6371.0

    def __init__(
        self,
        db_url: Optional[str] = None,
        event_catalog_path: Optional[str] = None,
    ):
        self._conn = None
        self._use_pgvector = False
        self.event_metadata: Dict[str, Dict[str, Any]] = {}

        # Try connecting to pgvector
        db_url = db_url or os.getenv("VECTOR_DATABASE_URL", "")
        if db_url:
            try:
                import psycopg2
                self._conn = psycopg2.connect(db_url)
                self._conn.autocommit = True
                self._use_pgvector = True
                logger.info("Connected to pgvector at %s", db_url.split("@")[-1] if "@" in db_url else db_url)
            except Exception as e:
                logger.warning("pgvector connection failed, using in-memory fallback: %s", e)
        else:
            logger.info("VECTOR_DATABASE_URL not set, using in-memory fallback")

        # Load event catalog for metadata (also used for fallback path)
        if event_catalog_path and os.path.exists(event_catalog_path):
            self._load_event_catalog(event_catalog_path)
        else:
            self._load_event_catalog_from_env()

    # ── Loading ──────────────────────────────────────────────────────────

    def _load_event_catalog(self, path: str) -> None:
        try:
            with open(path, "r") as f:
                events = json.load(f)
            for evt in events:
                eid = evt["id"]
                self.event_metadata[eid] = {
                    "title": evt.get("title", "Unknown"),
                    "category": evt.get("category", ""),
                    "genres": evt.get("genres", []),
                    "latitude": float(evt.get("latitude", 0.0)),
                    "longitude": float(evt.get("longitude", 0.0)),
                    "city": evt.get("city", ""),
                    "price": float(evt.get("price", 0.0)),
                    "max_attendees": int(evt.get("max_attendees", 0)),
                    "current_bookings": int(evt.get("current_bookings", 0)),
                    "start_time": evt.get("start_time", ""),
                    "status": evt.get("status", "PUBLISHED"),
                }
            logger.info("Loaded %d events from catalog: %s", len(self.event_metadata), path)
        except Exception as e:
            logger.warning("Failed to load event catalog from %s: %s", path, e)

    def _load_event_catalog_from_env(self) -> None:
        catalog_path = os.getenv("EVENT_CATALOG_PATH", "")
        if catalog_path and os.path.exists(catalog_path):
            self._load_event_catalog(catalog_path)
        else:
            logger.info("No event catalog available — metadata will be sparse")

    def update_event_metadata(self, events: List[Dict[str, Any]]) -> None:
        for evt in events:
            eid = evt["id"]
            self.event_metadata[eid] = {
                "title": evt.get("title", self.event_metadata.get(eid, {}).get("title", "Unknown")),
                "category": evt.get("category", ""),
                "genres": evt.get("genres", []),
                "latitude": float(evt.get("latitude", 0.0)),
                "longitude": float(evt.get("longitude", 0.0)),
                "city": evt.get("city", ""),
                "price": float(evt.get("price", 0.0)),
                "max_attendees": int(evt.get("max_attendees", 0)),
                "current_bookings": int(evt.get("current_bookings", 0)),
                "start_time": evt.get("start_time", ""),
                "status": evt.get("status", "PUBLISHED"),
            }

    # ── Candidate Generation ─────────────────────────────────────────────

    def generate_candidates(
        self,
        user_id: str,
        user_vector: Optional[np.ndarray] = None,
        user_location: Optional[Tuple[float, float]] = None,
        radius_km: float = 50.0,
        categories: Optional[List[str]] = None,
        genres: Optional[List[str]] = None,
        max_price: Optional[float] = None,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        """Generate candidate events for ranking.

        If user_vector is provided, queries pgvector with cosine distance.
        Otherwise falls back to heuristic/popularity scoring.

        Geo/category/genre/price filters are applied as SQL WHERE clauses
        on the jsonb metadata column, with exact haversine check as a
        post-filter when bounding-box pre-filter is used.
        """
        if self._use_pgvector and user_vector is not None:
            return self._pgvector_candidates(
                user_vector, user_location, radius_km,
                categories, genres, max_price, limit,
            )

        # Fallback: in-memory heuristic scoring
        return self._heuristic_candidates(
            user_id, user_location, radius_km,
            categories, genres, max_price, limit,
        )

    def _pgvector_candidates(
        self,
        user_vector: np.ndarray,
        user_location: Optional[Tuple[float, float]],
        radius_km: float,
        categories: Optional[List[str]],
        genres: Optional[List[str]],
        max_price: Optional[float],
        limit: int,
    ) -> List[Dict[str, Any]]:
        """Query pgvector with cosine distance + metadata filters."""
        vec_str = _to_vector_str(user_vector)

        conditions = ["metadata->>'status' = 'PUBLISHED'"]
        params: List[Any] = [vec_str]

        # Category filter
        if categories:
            placeholders = ",".join(["%s"] * len(categories))
            conditions.append(f"metadata->>'category' IN ({placeholders})")
            params.extend(categories)

        # Genre filter: jsonb array overlap
        if genres:
            genre_json = json.dumps(genres)
            conditions.append("metadata->'genres' ??| array(SELECT jsonb_array_elements_text(%s::jsonb))")
            params.append(genre_json)

        # Price filter
        if max_price is not None:
            conditions.append("(metadata->>'price')::float <= %s")
            params.append(max_price)

        # Geo bounding-box pre-filter (rough ±~1° lat per 111 km)
        if user_location is not None:
            lat, lon = user_location
            dlat = radius_km / 111.0
            dlon = radius_km / (111.0 * math.cos(math.radians(lat)) + 1e-8)
            conditions.append("(metadata->>'latitude')::float BETWEEN %s AND %s")
            params.extend([lat - dlat, lat + dlon])
            conditions.append("(metadata->>'longitude')::float BETWEEN %s AND %s")
            params.extend([lon - dlon, lon + dlon])

        where_clause = " AND ".join(conditions)

        # Fetch extra rows for post-filter margin (geo exact check)
        fetch_limit = limit * 3 if user_location else limit

        sql = f"""
            SELECT event_id, metadata,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM event_embeddings
            WHERE {where_clause}
            ORDER BY embedding <=> $1::vector
            LIMIT %s
        """
        params.append(fetch_limit)

        try:
            with self._conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        except Exception as e:
            logger.error("pgvector query failed: %s", e)
            return self._heuristic_candidates("", user_location, radius_km,
                                              categories, genres, max_price, limit)

        results: List[Dict[str, Any]] = []
        for event_id, metadata_json, similarity in rows:
            meta = metadata_json if isinstance(metadata_json, dict) else json.loads(metadata_json)

            # Exact haversine post-filter
            dist = None
            if user_location is not None:
                dist = self._haversine(
                    user_location[0], user_location[1],
                    float(meta.get("latitude", 0)), float(meta.get("longitude", 0)),
                )
                if dist > radius_km:
                    continue

            results.append({
                "id": event_id,
                "title": meta.get("title", event_id),
                "category": meta.get("category", ""),
                "genres": meta.get("genres", []),
                "latitude": float(meta.get("latitude", 0)),
                "longitude": float(meta.get("longitude", 0)),
                "city": meta.get("city", ""),
                "price": float(meta.get("price", 0)),
                "max_attendees": int(meta.get("max_attendees", 0)),
                "current_bookings": int(meta.get("current_bookings", 0)),
                "start_time": meta.get("start_time", ""),
                "distance_km": dist,
                "candidate_score": float(similarity),
            })

            if len(results) >= limit:
                break

        return results

    def _heuristic_candidates(
        self,
        _user_id: str,
        user_location: Optional[Tuple[float, float]],
        radius_km: float,
        categories: Optional[List[str]],
        genres: Optional[List[str]],
        max_price: Optional[float],
        limit: int,
    ) -> List[Dict[str, Any]]:
        """Fallback in-memory heuristic scoring when pgvector is unavailable."""
        if not self.event_metadata:
            return []

        cat_set = set(c.upper() for c in categories) if categories else None
        genre_set = set(g.lower().strip() for g in genres) if genres else None

        scored: List[Tuple[str, float]] = []
        now = datetime.now(timezone.utc)

        for eid, meta in self.event_metadata.items():
            if meta.get("status") != "PUBLISHED":
                continue

            bookings = meta.get("current_bookings", 0)
            capacity = max(meta.get("max_attendees", 1), 1)
            fill_ratio = bookings / capacity

            try:
                start_dt = datetime.fromisoformat(meta.get("start_time", "").replace("Z", "+00:00"))
                hours_until = (start_dt - now).total_seconds() / 3600.0
                time_score = math.exp(-max(hours_until, 0) / (24 * 14))
            except (ValueError, AttributeError):
                time_score = 0.5

            scored.append((eid, fill_ratio * 0.5 + time_score * 0.3 + 0.2))

        scored.sort(key=lambda x: x[1], reverse=True)

        results: List[Dict[str, Any]] = []
        for event_id, score in scored:
            meta = self.event_metadata[event_id]

            if cat_set and meta["category"].upper() not in cat_set:
                continue
            if genre_set:
                event_genres = set(g.lower().strip() for g in meta.get("genres", []))
                if not genre_set & event_genres:
                    continue
            if max_price is not None and meta.get("price", 0) > max_price:
                continue

            dist = None
            if user_location is not None:
                dist = self._haversine(
                    user_location[0], user_location[1],
                    meta["latitude"], meta["longitude"],
                )
                if dist > radius_km:
                    continue

            results.append({
                "id": event_id,
                "title": meta["title"],
                "category": meta["category"],
                "genres": meta.get("genres", []),
                "latitude": meta["latitude"],
                "longitude": meta["longitude"],
                "city": meta["city"],
                "price": meta["price"],
                "max_attendees": meta["max_attendees"],
                "current_bookings": meta["current_bookings"],
                "start_time": meta["start_time"],
                "distance_km": dist,
                "candidate_score": score,
            })

            if len(results) >= limit:
                break

        return results

    # ── Similar Events ──────────────────────────────────────────────────

    def get_similar_events(
        self,
        event_id: str,
        top_k: int = 50,
    ) -> List[Dict[str, Any]]:
        """Find events similar to a given event via pgvector cosine distance."""
        if self._use_pgvector:
            return self._pgvector_similar(event_id, top_k)
        return self._content_similar(event_id, top_k)

    def _pgvector_similar(self, event_id: str, top_k: int) -> List[Dict[str, Any]]:
        sql = """
            SELECT e2.event_id, e2.metadata,
                   1 - (e1.embedding <=> e2.embedding) AS similarity
            FROM event_embeddings e1
            CROSS JOIN event_embeddings e2
            WHERE e1.event_id = %s
              AND e2.event_id != %s
              AND e2.metadata->>'status' = 'PUBLISHED'
            ORDER BY e1.embedding <=> e2.embedding
            LIMIT %s
        """
        try:
            with self._conn.cursor() as cur:
                cur.execute(sql, (event_id, event_id, top_k))
                rows = cur.fetchall()
        except Exception as e:
            logger.error("pgvector similar-events query failed: %s", e)
            return self._content_similar(event_id, top_k)

        results = []
        for eid, metadata_json, similarity in rows:
            meta = metadata_json if isinstance(metadata_json, dict) else json.loads(metadata_json)
            results.append({
                "id": eid,
                "title": meta.get("title", eid),
                "category": meta.get("category", ""),
                "genres": meta.get("genres", []),
                "latitude": float(meta.get("latitude", 0)),
                "longitude": float(meta.get("longitude", 0)),
                "price": float(meta.get("price", 0)),
                "similarity_score": float(similarity),
            })
        return results

    def _content_similar(self, event_id: str, top_k: int) -> List[Dict[str, Any]]:
        """Fallback: find similar events via shared category + genre overlap."""
        source = self.event_metadata.get(event_id)
        if source is None:
            return []

        source_cat = source.get("category", "").upper()
        source_genres = set(g.lower().strip() for g in source.get("genres", []))

        scores = []
        for eid, meta in self.event_metadata.items():
            if eid == event_id or meta.get("status") != "PUBLISHED":
                continue
            cat_match = 1.0 if meta.get("category", "").upper() == source_cat else 0.0
            target_genres = set(g.lower().strip() for g in meta.get("genres", []))
            union = source_genres | target_genres
            genre_overlap = len(source_genres & target_genres) / max(len(union), 1)
            score = cat_match * 0.4 + genre_overlap * 0.6
            if score > 0:
                scores.append((eid, score))

        scores.sort(key=lambda x: x[1], reverse=True)

        results = []
        for eid, score in scores[:top_k]:
            meta = self.event_metadata[eid]
            results.append({
                "id": eid,
                "title": meta["title"],
                "category": meta["category"],
                "genres": meta.get("genres", []),
                "latitude": meta["latitude"],
                "longitude": meta["longitude"],
                "price": meta["price"],
                "similarity_score": score,
            })
        return results

    # ── Trending ─────────────────────────────────────────────────────────

    def get_trending(
        self,
        city: Optional[str] = None,
        limit: int = 60,
    ) -> List[Dict[str, Any]]:
        """Get trending events from pgvector metadata (no vector search needed)."""
        if self._use_pgvector:
            return self._pgvector_trending(city, limit)
        return self._heuristic_trending(city, limit)

    def _pgvector_trending(self, city: Optional[str], limit: int) -> List[Dict[str, Any]]:
        conditions = ["metadata->>'status' = 'PUBLISHED'"]
        params: List[Any] = []

        if city:
            conditions.append("metadata->>'city' = %s")
            params.append(city)

        where_clause = " AND ".join(conditions)
        sql = f"""
            SELECT event_id, metadata,
                   (metadata->>'current_bookings')::float /
                     GREATEST((metadata->>'max_attendees')::float, 1) AS fill_ratio
            FROM event_embeddings
            WHERE {where_clause}
            ORDER BY fill_ratio DESC
            LIMIT %s
        """
        params.append(limit)

        try:
            with self._conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        except Exception as e:
            logger.error("pgvector trending query failed: %s", e)
            return self._heuristic_trending(city, limit)

        results = []
        for event_id, metadata_json, fill_ratio in rows:
            meta = metadata_json if isinstance(metadata_json, dict) else json.loads(metadata_json)
            results.append({
                "id": event_id,
                "title": meta.get("title", event_id),
                "category": meta.get("category", ""),
                "genres": meta.get("genres", []),
                "latitude": float(meta.get("latitude", 0)),
                "longitude": float(meta.get("longitude", 0)),
                "city": meta.get("city", ""),
                "price": float(meta.get("price", 0)),
                "current_bookings": int(meta.get("current_bookings", 0)),
                "trending_score": float(fill_ratio),
            })
        return results

    def _heuristic_trending(self, city: Optional[str], limit: int) -> List[Dict[str, Any]]:
        candidates = []
        for eid, meta in self.event_metadata.items():
            if meta.get("status") != "PUBLISHED":
                continue
            if city and meta.get("city", "").lower() != city.lower():
                continue

            bookings = meta.get("current_bookings", 0)
            capacity = max(meta.get("max_attendees", 1), 1)
            fill_ratio = bookings / capacity

            try:
                start_dt = datetime.fromisoformat(meta.get("start_time", "").replace("Z", "+00:00"))
                days_until = max((start_dt - datetime.now(timezone.utc)).days, 0)
                recency_boost = math.exp(-days_until / 30.0)
            except (ValueError, AttributeError):
                recency_boost = 0.1

            score = fill_ratio * 0.6 + recency_boost * 0.4
            candidates.append((eid, score))

        candidates.sort(key=lambda x: x[1], reverse=True)

        results = []
        for event_id, score in candidates[:limit]:
            meta = self.event_metadata[event_id]
            results.append({
                "id": event_id,
                "title": meta["title"],
                "category": meta["category"],
                "genres": meta.get("genres", []),
                "latitude": meta["latitude"],
                "longitude": meta["longitude"],
                "city": meta["city"],
                "price": meta["price"],
                "current_bookings": meta["current_bookings"],
                "trending_score": score,
            })
        return results

    # ── Vector helpers ──────────────────────────────────────────────────

    def get_user_embedding(self, user_id: str) -> Optional[np.ndarray]:
        """Fetch a user embedding from pgvector."""
        if not self._use_pgvector:
            return None
        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT embedding FROM user_embeddings WHERE user_id = %s",
                    (user_id,),
                )
                row = cur.fetchone()
                if row:
                    emb_str = row[0]
                    return _parse_vector_str(emb_str) if isinstance(emb_str, str) else np.array(emb_str, dtype=np.float32)
        except Exception as e:
            logger.warning("Failed to fetch user embedding: %s", e)
        return None

    def get_event_embedding(self, event_id: str) -> Optional[np.ndarray]:
        """Fetch an event embedding from pgvector."""
        if not self._use_pgvector:
            return None
        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT embedding FROM event_embeddings WHERE event_id = %s",
                    (event_id,),
                )
                row = cur.fetchone()
                if row:
                    emb_str = row[0]
                    return _parse_vector_str(emb_str) if isinstance(emb_str, str) else np.array(emb_str, dtype=np.float32)
        except Exception as e:
            logger.warning("Failed to fetch event embedding: %s", e)
        return None

    def get_event_embeddings_batch(self, event_ids: List[str]) -> Dict[str, np.ndarray]:
        """Batch-fetch event embeddings from pgvector."""
        if not self._use_pgvector or not event_ids:
            return {}
        try:
            with self._conn.cursor() as cur:
                cur.execute(
                    "SELECT event_id, embedding FROM event_embeddings WHERE event_id = ANY(%s)",
                    (event_ids,),
                )
                result = {}
                for event_id, emb_val in cur.fetchall():
                    emb = _parse_vector_str(emb_val) if isinstance(emb_val, str) else np.array(emb_val, dtype=np.float32)
                    result[event_id] = emb
                return result
        except Exception as e:
            logger.warning("Failed to batch-fetch event embeddings: %s", e)
            return {}

    def close(self) -> None:
        if self._conn:
            self._conn.close()

    # ── Utility ──────────────────────────────────────────────────────────

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        return CandidateGenerator.EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(a))
