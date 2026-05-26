#!/usr/bin/env python3
"""
End-to-end ML data pipeline for location-aware and category-aware event recommendations.

Architecture:
  1. EXTRACT  — Read from Kafka topic archives (backfill) + PostgreSQL (entity state)
  2. TRANSFORM — Feature engineering (see feature_engineering.py)
  3. LOAD      — Write feature vectors to Redis Feature Store + training parquet files
  4. TRAIN     — Train ranking models (see trainers/)

Scales via PySpark for batch, with configurable window sizing for incremental runs.
"""

from __future__ import annotations

import json as json_mod
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from feature_engineering import (
    LocationFeatureEngineer,
    CategoryFeatureEngineer,
    CollaborativeFeatureEngineer,
    TemporalFeatureEngineer,
    EngagementFeatureEngineer,
    InterestSimilarityFeatureEngineer,
    ParticipantCooccurrenceFeatureEngineer,
    FeatureStore,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("data-pipeline")


class DataPipeline:
    """
    Orchestrates data extraction, feature engineering, feature store writes,
    and model training for the recommendation system.

    Supports two modes:
      - full: Backfill from all available data
      - incremental: Process only new data since last run (default)
    """

    def __init__(
        self,
        mode: str = "incremental",
        window_days: int = 30,
        feature_store_url: str = "redis://localhost:6379",
        output_path: str = "/data/training",
        export_catalog: bool = False,
        source_db_url: str = "",
    ):
        self.mode = mode
        self.window_days = window_days
        self.output_path = output_path
        self.export_catalog = export_catalog
        self.source_db_url = source_db_url or os.getenv(
            "SOURCE_DATABASE_URL",
            "postgresql://eventbooking:eventbooking123@localhost:5432/eventbooking",
        )

        # Feature engineers — each handles one domain
        self.location_engineer = LocationFeatureEngineer()
        self.category_engineer = CategoryFeatureEngineer()
        self.collaborative_engineer = CollaborativeFeatureEngineer()
        self.temporal_engineer = TemporalFeatureEngineer()
        self.engagement_engineer = EngagementFeatureEngineer()
        self.interest_similarity_engineer = InterestSimilarityFeatureEngineer()
        self.participant_engineer = ParticipantCooccurrenceFeatureEngineer()

        # Feature store for online serving
        self.feature_store = FeatureStore(feature_store_url)

        # Cutoff for incremental mode
        self.since = datetime.now(timezone.utc) - timedelta(days=window_days)

        # Source DB connection (lazy)
        self._source_conn = None

    # ── Phase 1: Extract ──────────────────────────────────────────────

    def _get_source_conn(self):
        """Lazy-init a psycopg2 connection to the source databases."""
        if self._source_conn is not None:
            return self._source_conn
        try:
            import psycopg2
            self._source_conn = psycopg2.connect(self.source_db_url)
            self._source_conn.autocommit = True
            logger.info("Connected to source DB: %s", self.source_db_url.split("@")[-1] if "@" in self.source_db_url else self.source_db_url)
        except Exception as e:
            logger.warning("Source DB connection failed: %s", e)
            self._source_conn = None
        return self._source_conn

    def _query(self, sql: str, params: list = None) -> pd.DataFrame:
        """Run a query and return results as a DataFrame."""
        conn = self._get_source_conn()
        if conn is None:
            return pd.DataFrame()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params or [])
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                return pd.DataFrame(rows, columns=columns)
        except Exception as e:
            logger.error("Query failed: %s", e)
            return pd.DataFrame()

    def _extract_from_source_db(self) -> Dict[str, pd.DataFrame]:
        """Extract data from PostgreSQL source databases.

        Queries event_db for events, user_db for users and activities.
        Maps to the DataFrame schemas expected by the feature engineers.
        """
        datasets: Dict[str, pd.DataFrame] = {}

        # ── Event lifecycle (from event_db.public.events) ──────────
        df_events = self._query("""
            SELECT
                id AS "eventId",
                vendor_id AS "vendorId",
                'event_' || LOWER(status::text) AS "type",
                created_at AS "timestamp",
                category::text AS "event_category",
                sub_category AS "event_subCategory",
                tags AS "event_genres",
                tags AS "event_tags",
                COALESCE(location->>'city', '') AS "event_location_city",
                COALESCE(location->>'country', '') AS "event_location_country",
                COALESCE((location->>'latitude')::float, 0) AS "event_location_lat",
                COALESCE((location->>'longitude')::float, 0) AS "event_location_lon",
                COALESCE((price->>'min')::float, 0) AS "event_pricing_min",
                COALESCE((price->>'max')::float, 0) AS "event_pricing_max",
                COALESCE(max_attendees, 0) AS "event_capacity"
            FROM event_db.public.events
            WHERE status = 'PUBLISHED'
        """)
        if len(df_events):
            df_events["event_genres"] = df_events["event_genres"].apply(
                lambda x: x if isinstance(x, list) else []
            )
            df_events["event_tags"] = df_events["event_tags"].apply(
                lambda x: x if isinstance(x, list) else []
            )
            df_events["timestamp"] = pd.to_datetime(df_events["timestamp"])
            datasets["event_lifecycle"] = df_events
            logger.info("  event-lifecycle (from event_db): %d rows", len(df_events))
        else:
            datasets["event_lifecycle"] = self._empty_schema("event-lifecycle")

        # ── User activities (from user_db.public.user_activities) ──
        df_ua = self._query("""
            SELECT
                ua.user_id AS "userId",
                '' AS "sessionId",
                CASE ua.event_type
                    WHEN 'VIEW_EVENT' THEN 'event_view'
                    WHEN 'BOOKING_CREATED' THEN 'booking_confirmed'
                    WHEN 'BOOKING_CANCELLED' THEN 'booking_cancelled'
                    WHEN 'SEARCH' THEN 'search_query'
                    ELSE LOWER(ua.event_type::text)
                END AS "type",
                ua.timestamp,
                '' AS "pageUrl",
                ua.metadata->>'eventId' AS "eventId",
                ua.metadata->>'category' AS "eventCategory",
                COALESCE((ua.metadata->>'lat')::float, 0) AS "lat",
                COALESCE((ua.metadata->>'lon')::float, 0) AS "lon",
                ua.metadata->>'city' AS "city"
            FROM user_db.public.user_activities ua
            JOIN user_db.public.users u ON ua.user_id = u.id
        """)
        if len(df_ua):
            df_ua["timestamp"] = pd.to_datetime(df_ua["timestamp"])
            datasets["user_activities"] = df_ua.rename(columns={
                "eventId": "metadata_eventId",
                "eventCategory": "metadata_eventCategory",
                "lat": "metadata_location_lat",
                "lon": "metadata_location_lon",
                "city": "metadata_location_city",
            })
            logger.info("  user_activities (from user_db): %d rows", len(df_ua))
        else:
            datasets["user_activities"] = self._empty_schema("user-activities")

        # ── Booking events (positive labels from user_activities) ──
        df_bookings = self._query("""
            SELECT
                ua.id AS "bookingId",
                ua.user_id AS "userId",
                ua.metadata->>'eventId' AS "eventId",
                '' AS "vendorId",
                'booking_confirmed' AS "type",
                ua.timestamp,
                ua.metadata->>'category' AS "event_category",
                '[]'::json AS "event_genres",
                ua.metadata->>'city' AS "event_location_city",
                COALESCE((ua.metadata->>'lat')::float, 0) AS "event_location_lat",
                COALESCE((ua.metadata->>'lon')::float, 0) AS "event_location_lon",
                '' AS "source_channel",
                '' AS "source_recommendationId",
                '' AS "source_recommendationModel",
                NULL AS "attendeeRating"
            FROM user_db.public.user_activities ua
            WHERE ua.event_type = 'BOOKING_CREATED'
        """)
        if len(df_bookings):
            df_bookings["event_genres"] = df_bookings["event_genres"].apply(
                lambda x: x if isinstance(x, list) else []
            )
            df_bookings["timestamp"] = pd.to_datetime(df_bookings["timestamp"])
            datasets["booking_events"] = df_bookings
            logger.info("  booking-events (from user_db): %d rows", len(df_bookings))
        else:
            datasets["booking_events"] = self._empty_schema("booking-events")

        # ── Streaming-only topics: empty for now (fed by Kafka consumer) ──
        for topic in ("search-events", "recommendation-feedback", "location-context"):
            datasets[topic.replace("-", "_")] = self._empty_schema(topic)

        return datasets

    def _empty_schema(self, topic: str) -> pd.DataFrame:
        """Return an empty DataFrame with the expected schema for a topic."""
        return self._extract_kafka_archive(topic, since=None)

    def extract(self) -> Dict[str, pd.DataFrame]:
        """
        Extract raw data from all sources.

        Reads from PostgreSQL source databases for entity state
        (events, users, bookings). Streaming-only topics (search,
        recommendations, location) return empty schemas until
        Kafka Connect dumps are available.

        Returns a dict of DataFrames keyed by event type.
        """
        logger.info("Extracting data (mode=%s, window=%dd)", self.mode, self.window_days)

        datasets = self._extract_from_source_db()

        for name, df in datasets.items():
            logger.info("  %s: %d rows", name, len(df))

        return datasets

    def _extract_kafka_archive(self, topic: str, since: Optional[datetime] = None) -> pd.DataFrame:
        """
        Read from Kafka topic archive.

        In production this queries the data lake (S3/GCS parquet files written
        by Kafka Connect S3 sink). For local dev, returns a structured empty
        DataFrame with the expected schema so downstream feature engineers work.

        The schema for each topic is defined in apps/python-workers/schemas/.
        """
        # Schema definitions for all 6 topics — ensures feature engineers
        # always receive correctly-typed columns even if the archive is empty.
        schemas: Dict[str, Dict[str, Any]] = {
            "user-activities": {
                "userId": "str", "sessionId": "str", "type": "str",
                "timestamp": "datetime64[ns]", "pageUrl": "str",
                "metadata_eventId": "str", "metadata_eventCategory": "str",
                "metadata_eventGenres": "object", "metadata_category": "str",
                "metadata_location_lat": "float64", "metadata_location_lon": "float64",
                "metadata_location_city": "str", "metadata_vendorId": "str",
                "metadata_clickPosition": "Int64", "metadata_sourceList": "str",
                "metadata_dwellTimeMs": "Int64",
            },
            "event-lifecycle": {
                "eventId": "str", "vendorId": "str", "type": "str",
                "timestamp": "datetime64[ns]",
                "event_category": "str", "event_subCategory": "str",
                "event_genres": "object", "event_tags": "object",
                "event_location_city": "str", "event_location_country": "str",
                "event_location_lat": "float64", "event_location_lon": "float64",
                "event_pricing_min": "float64", "event_pricing_max": "float64",
                "event_capacity": "int64",
            },
            "booking-events": {
                "bookingId": "str", "userId": "str", "eventId": "str",
                "vendorId": "str", "type": "str", "timestamp": "datetime64[ns]",
                "event_category": "str", "event_genres": "object",
                "event_location_city": "str",
                "event_location_lat": "float64", "event_location_lon": "float64",
                "source_channel": "str", "source_recommendationId": "str",
                "source_recommendationModel": "str",
                "attendeeRating": "Int64",
            },
            "search-events": {
                "userId": "str", "sessionId": "str", "searchId": "str",
                "type": "str", "timestamp": "datetime64[ns]",
                "search_query": "str", "search_normalizedQuery": "str",
                "search_filters_location_lat": "float64",
                "search_filters_location_lon": "float64",
                "search_filters_location_radiusKm": "float64",
                "search_filters_category": "object",
                "search_filters_genres": "object",
                "search_resultCount": "Int64",
                "click_eventId": "str", "click_eventCategory": "str",
                "click_position": "Int64",
                "click_eventLocation_lat": "float64",
                "click_eventLocation_lon": "float64",
                "abandon_timeOnPageMs": "Int64",
            },
            "recommendation-feedback": {
                "userId": "str", "sessionId": "str",
                "recommendationId": "str", "modelId": "str",
                "type": "str", "timestamp": "datetime64[ns]",
                "placement_page": "str", "placement_widget": "str",
            },
            "location-context": {
                "userId": "str", "sessionId": "str", "type": "str",
                "timestamp": "datetime64[ns]",
                "location_lat": "float64", "location_lon": "float64",
                "location_city": "str", "location_country": "str",
                "location_neighborhood": "str",
                "search_radiusKm": "float64",
                "mapView_zoomLevel": "float64",
                "mapView_centerLat": "float64", "mapView_centerLon": "float64",
                "geofence_name": "str", "geofence_eventDensity": "float64",
            },
        }

        if topic in schemas:
            return pd.DataFrame({col: pd.Series(dtype=t) for col, t in schemas[topic].items()})
        return pd.DataFrame()

    def _export_event_catalog(self, event_lifecycle: pd.DataFrame) -> str:
        """Export published events as a JSON catalog for CandidateGenerator.

        Extracts the latest state per event from the lifecycle Kafka topic
        and writes event_catalog.json to the output path.

        Returns the path of the written catalog file.
        """
        import json

        if event_lifecycle is None or len(event_lifecycle) == 0:
            logger.warning("No event lifecycle data, skipping catalog export")
            return ""

        # Sort by timestamp descending and deduplicate by eventId
        df = event_lifecycle.sort_values("timestamp", ascending=False)
        df = df.drop_duplicates(subset=["eventId"], keep="first")

        # Only include published events
        published = df[df["type"] == "event_published"]

        catalog = []
        for _, row in published.iterrows():
            genres = row.get("event_genres", [])
            if isinstance(genres, float):
                genres = []
            elif isinstance(genres, str):
                genres = [genres]

            catalog.append({
                "id": str(row["eventId"]),
                "vendorId": str(row.get("vendorId", "")),
                "category": str(row.get("event_category", "")),
                "subCategory": str(row.get("event_subCategory", "")),
                "genres": [str(g) for g in genres],
                "tags": row.get("event_tags", []),
                "city": str(row.get("event_location_city", "")),
                "country": str(row.get("event_location_country", "")),
                "latitude": float(row.get("event_location_lat", 0.0)),
                "longitude": float(row.get("event_location_lon", 0.0)),
                "price_min": float(row.get("event_pricing_min", 0.0)),
                "price_max": float(row.get("event_pricing_max", 0.0)),
                "maxAttendees": int(row.get("event_capacity", 0)),
                "publishedAt": str(row.get("timestamp", "")),
            })

        os.makedirs(self.output_path, exist_ok=True)
        catalog_path = os.path.join(self.output_path, "event_catalog.json")

        with open(catalog_path, "w") as f:
            json.dump(catalog, f, default=str)

        logger.info("Exported %d published events to %s", len(catalog), catalog_path)
        return catalog_path

    # ── Phase 2: Transform ────────────────────────────────────────────

    def transform(self, datasets: Dict[str, pd.DataFrame]) -> Dict[str, np.ndarray]:
        """
        Run all feature engineers over the extracted data.

        Returns a dict of feature arrays keyed by feature group:
          - location_features:  (n_samples, n_location_features)
          - category_features:  (n_samples, n_category_features)
          - collaborative_features: (n_samples, n_latent_features)
          - temporal_features:  (n_samples, n_temporal_features)
          - engagement_features: (n_samples, n_engagement_features)
          - labels:             (n_samples,)  — booking or strong engagement
        """
        logger.info("Transforming features...")

        features: Dict[str, np.ndarray] = {}

        # 1. Location features: geo-proximity, clusters, venue affinity
        features["location"] = self.location_engineer.fit_transform(
            user_activities=datasets.get("user_activities"),
            location_context=datasets.get("location_context"),
            search_events=datasets.get("search_events"),
            booking_events=datasets.get("booking_events"),
            event_lifecycle=datasets.get("event_lifecycle"),
        )
        logger.info("  location features: %s", features["location"].shape)

        # 2. Category features: genre affinity, category co-occurrence, text embeddings
        features["category"] = self.category_engineer.fit_transform(
            user_activities=datasets.get("user_activities"),
            booking_events=datasets.get("booking_events"),
            search_events=datasets.get("search_events"),
            event_lifecycle=datasets.get("event_lifecycle"),
            recommendation_feedback=datasets.get("recommendation_feedback"),
        )
        logger.info("  category features: %s", features["category"].shape)

        # 3. Collaborative features: user-user & event-event similarity, matrix factorization
        features["collaborative"] = self.collaborative_engineer.fit_transform(
            booking_events=datasets.get("booking_events"),
            user_activities=datasets.get("user_activities"),
            recommendation_feedback=datasets.get("recommendation_feedback"),
        )
        logger.info("  collaborative features: %s", features["collaborative"].shape)

        # 4. Temporal features: time-of-day, day-of-week, seasonal, recency
        features["temporal"] = self.temporal_engineer.fit_transform(
            user_activities=datasets.get("user_activities"),
            booking_events=datasets.get("booking_events"),
            search_events=datasets.get("search_events"),
        )
        logger.info("  temporal features: %s", features["temporal"].shape)

        # 5. Engagement features: funnel rates, dwell time, session depth
        features["engagement"] = self.engagement_engineer.fit_transform(
            user_activities=datasets.get("user_activities"),
            recommendation_feedback=datasets.get("recommendation_feedback"),
        )
        logger.info("  engagement features: %s", features["engagement"].shape)

        # 6. Interest similarity: explicit user-interest to event-tag matching
        features["interest_similarity"] = self.interest_similarity_engineer.fit_transform(
            user_activities=datasets.get("user_activities"),
            event_lifecycle=datasets.get("event_lifecycle"),
            booking_events=datasets.get("booking_events"),
        )
        logger.info("  interest similarity features: %s", features["interest_similarity"].shape)

        # 7. Participant co-occurrence: signals from co-attendees
        features["participant"] = self.participant_engineer.fit_transform(
            booking_events=datasets.get("booking_events"),
            user_activities=datasets.get("user_activities"),
        )
        logger.info("  participant features: %s", features["participant"].shape)

        # 8. Labels: positive = booking or strong engagement
        features["labels"] = self._build_labels(
            booking_events=datasets.get("booking_events"),
            user_activities=datasets.get("user_activities"),
            recommendation_feedback=datasets.get("recommendation_feedback"),
        )
        logger.info("  labels: %s", features["labels"].shape)

        return features

    def _build_labels(
        self,
        booking_events: Optional[pd.DataFrame],
        user_activities: Optional[pd.DataFrame],
        recommendation_feedback: Optional[pd.DataFrame],
    ) -> np.ndarray:
        """
        Build training labels.

        Positive class (1):
          - User booked the event (booking_confirmed, booking_attended)
          - User saved/favorited the event
          - User clicked through from recommendation AND dwelled > 10s

        Negative class (0):
          - User viewed event but did not book (implicit negative from impressions)
          - User dismissed the recommendation
        """
        positive_user_event: set = set()
        negative_user_event: set = set()

        if booking_events is not None and len(booking_events) > 0:
            positive = booking_events[
                booking_events["type"].isin(["booking_confirmed", "booking_attended"])
            ]
            for _, row in positive.iterrows():
                positive_user_event.add((row["userId"], row["eventId"]))

        if user_activities is not None and len(user_activities) > 0:
            saves = user_activities[user_activities["type"] == "event_save"]
            for _, row in saves.iterrows():
                eid = row.get("metadata_eventId")
                if eid:
                    positive_user_event.add((row["userId"], str(eid)))

        if recommendation_feedback is not None and len(recommendation_feedback) > 0:
            conversions = recommendation_feedback[
                recommendation_feedback["type"] == "conversion"
            ]
            for _, row in conversions.iterrows():
                positive_user_event.add((row["userId"], "rec"))  # marker

            dismissals = recommendation_feedback[
                recommendation_feedback["type"] == "dismiss"
            ]
            for _, row in dismissals.iterrows():
                negative_user_event.add((row["userId"], "rec"))

        if not positive_user_event and not negative_user_event:
            return np.array([])

        all_pairs = list(positive_user_event | negative_user_event)
        labels = np.array([
            1 if pair in positive_user_event else 0
            for pair in all_pairs
        ], dtype=np.float32)

        return labels

    # ── Phase 3: Load ─────────────────────────────────────────────────

    def load(self, features: Dict[str, np.ndarray]) -> None:
        """
        Write features to the Feature Store (Redis) for online inference
        and to parquet files for batch training.
        """
        logger.info("Loading features to store...")

        # Write to Redis Feature Store (real-time serving)
        self.feature_store.batch_put(features)

        # Store per-user and per-event profiles for inference-time lookup
        self._store_profiles()

        # Write to disk for training
        os.makedirs(self.output_path, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        for name, array in features.items():
            path = os.path.join(self.output_path, f"{name}_{timestamp}.npy")
            np.save(path, array)
            logger.info("  Saved %s -> %s (shape=%s)", name, path, array.shape)

    def _store_profiles(self) -> None:
        """Store per-user and per-event profiles in Redis for inference-time lookup."""
        logger.info("Storing user/event profiles to Redis...")

        # ── Per-user profiles ─────────────────────────────────────────
        for uid in self.location_engineer.user_location_profile:
            profile = {}
            loc = self.location_engineer.user_location_profile.get(uid, {})
            if loc:
                profile.update({
                    "home_lat": loc.get("home_lat", 0.0),
                    "home_lon": loc.get("home_lon", 0.0),
                    "home_city": loc.get("home_city", ""),
                    "typical_radius_km": loc.get("typical_radius_km", 10.0),
                    "n_unique_cities": loc.get("n_unique_cities", 0),
                    "n_unique_neighborhoods": loc.get("n_unique_neighborhoods", 0),
                    "location_entropy": loc.get("location_entropy", 0.0),
                })
            cf = self.collaborative_engineer.user_factors.get(uid)
            if cf is not None:
                profile["user_embedding"] = cf.tolist()
            else:
                profile["user_embedding"] = np.zeros(16, dtype=np.float32).tolist()
            ue = self.engagement_engineer.user_engagement.get(uid, {})
            if ue:
                profile["engagement"] = dict(ue)
            co = self.participant_engineer.user_event_sets.get(uid, set())
            cg = self.participant_engineer.coattendee_graph.get(uid, {})
            profile["coattendee_data"] = {
                "coattendee_count": len(cg),
                "n_events": len(co),
            }
            interests = self.interest_similarity_engineer.user_interest_vecs.get(uid)
            if interests is not None:
                profile["interest_vector"] = interests[:5].tolist() if len(interests) > 5 else interests.tolist()
            self.feature_store.save_user_profile(uid, profile)
        logger.info("  stored %d user profiles", len(self.location_engineer.user_location_profile))

        # ── Per-event profiles ────────────────────────────────────────
        for eid in self.location_engineer.event_location_profile:
            profile = {}
            eloc = self.location_engineer.event_location_profile.get(eid, {})
            if eloc:
                profile.update({
                    "latitude": eloc.get("lat", 0.0),
                    "longitude": eloc.get("lon", 0.0),
                    "city_popularity": eloc.get("city_popularity", 0.5),
                    "venue_bookings": eloc.get("venue_bookings", 0),
                    "venue_repeat_rate": eloc.get("venue_repeat_rate", 0.0),
                    "venue_unique_users": eloc.get("venue_unique_users", 0),
                })
            ef = self.collaborative_engineer.event_factors.get(eid)
            if ef is not None:
                profile["event_embedding"] = ef.tolist()
            self.feature_store.save_event_profile(eid, profile)
        logger.info("  stored %d event profiles", len(self.location_engineer.event_location_profile))

    # ── Phase 4: Train ────────────────────────────────────────────────

    def train(self, features: Dict[str, np.ndarray], datasets: Dict[str, pd.DataFrame]) -> Optional[Any]:
        """
        Trigger model training with the prepared features.

        Returns the EmbeddingTrainer instance (with loaded embeddings) if
        embedding training ran, otherwise None.
        """
        if features.get("labels") is None or len(features["labels"]) == 0:
            logger.warning("No labels available, skipping training")
            return None

        logger.info("Starting model training...")

        # Import here to avoid circular dependency
        from trainers.ranking_trainer import RankingTrainer

        trainer = RankingTrainer(
            output_path=os.path.join(self.output_path, "models"),
            feature_store=self.feature_store,
        )
        trainer.train(features)

        # Train embeddings from the full feature store (SVD), not just collaborative factors
        embedding_trainer = self._train_embeddings(datasets, features)
        return embedding_trainer

    def _train_embeddings(
        self, datasets: Dict[str, pd.DataFrame], features: Dict[str, np.ndarray]
    ) -> Optional[Any]:
        """Train user and event embeddings from the full feature store via SVD.

        Builds per-user and per-event feature vectors by concatenating all
        7 feature engineers' outputs, then factorizes the user-event booking
        matrix into a shared 64-dim embedding space via TruncatedSVD.

        This means the feature store IS the definition of relevance — pgvector
        embeddings are a compressed view of the same features used for ranking.
        """
        from trainers.embedding_trainer import EmbeddingTrainer

        booking_events = datasets.get("booking_events")
        if booking_events is None or len(booking_events) == 0:
            logger.warning("No booking data, skipping embedding training")
            return None

        # ── Build per-user feature vectors from all 7 engineers ──────
        user_features: Dict[str, np.ndarray] = {}
        all_user_ids: Set[str] = set()

        # 1. Location engineer — per-user profiles
        for uid, profile in self.location_engineer.user_location_profile.items():
            all_user_ids.add(uid)

        # 2. Category engineer
        for uid in self.category_engineer.user_genre_affinity:
            all_user_ids.add(uid)
        for uid in self.category_engineer.user_category_affinity:
            all_user_ids.add(uid)

        # 3. Collaborative engineer
        for uid in self.collaborative_engineer.user_factors:
            all_user_ids.add(uid)

        # 4. Temporal engineer
        for uid in self.temporal_engineer.user_hour_dist:
            all_user_ids.add(uid)

        # 5. Engagement engineer
        for uid in self.engagement_engineer.user_engagement:
            all_user_ids.add(uid)

        # 6. Interest similarity engineer
        for uid in self.interest_similarity_engineer.user_interest_vecs:
            all_user_ids.add(uid)

        # 7. Participant co-occurrence engineer
        for uid in self.participant_engineer.user_event_sets:
            all_user_ids.add(uid)

        # ── Build per-event feature vectors ──────────────────────────
        event_features: Dict[str, np.ndarray] = {}
        all_event_ids: Set[str] = set()

        # From location engineer
        for eid in self.location_engineer.event_location_profile:
            all_event_ids.add(eid)

        # From collaborative engineer
        for eid in self.collaborative_engineer.event_factors:
            all_event_ids.add(eid)

        # From interest engineer
        for eid in self.interest_similarity_engineer.event_tag_vecs:
            all_event_ids.add(eid)

        # From participant engineer
        for eid in self.participant_engineer.event_user_sets:
            all_event_ids.add(eid)

        # Also include events from booking data
        if booking_events is not None and len(booking_events) > 0:
            for _, row in booking_events.iterrows():
                eid = str(row.get("eventId", ""))
                if eid:
                    all_event_ids.add(eid)

        # ── Concatenate feature vectors per user ─────────────────────
        for uid in all_user_ids:
            parts: List[np.ndarray] = []

            # Location: 9-dim profile vector
            loc = self.location_engineer.user_location_profile.get(uid, {})
            if loc:
                parts.append(np.array([
                    loc.get("home_lat", 0), loc.get("home_lon", 0),
                    loc.get("typical_radius_km", 10),
                    float(loc.get("n_unique_cities", 0)),
                    float(loc.get("n_unique_neighborhoods", 0)),
                    loc.get("location_entropy", 0),
                    loc.get("home_lat_std", 0), loc.get("home_lon_std", 0),
                    float(loc.get("n_location_signals", 0)),
                ], dtype=np.float32))
            else:
                parts.append(np.zeros(9, dtype=np.float32))

            # Category: genre affinity + category affinity
            genre_vec = self.category_engineer.user_genre_affinity.get(uid)
            cat_vec = self.category_engineer.user_category_affinity.get(uid)
            if genre_vec is not None:
                parts.append(genre_vec[:10] if len(genre_vec) > 10 else np.pad(genre_vec, (0, max(0, 10 - len(genre_vec)))))
            else:
                parts.append(np.zeros(10, dtype=np.float32))
            if cat_vec is not None:
                parts.append(cat_vec)
            else:
                parts.append(np.zeros(len(self.category_engineer.CATEGORIES), dtype=np.float32))

            # Collaborative: 16-dim latent factors + bias
            cf = self.collaborative_engineer.user_factors.get(uid)
            cb = self.collaborative_engineer.user_biases.get(uid, 0.0)
            if cf is not None:
                parts.append(cf)
                parts.append(np.array([cb], dtype=np.float32))
            else:
                parts.append(np.zeros(17, dtype=np.float32))

            # Temporal: 24-dim hour dist + 7-dim DOW dist + lead time
            hour = self.temporal_engineer.user_hour_dist.get(uid)
            dow = self.temporal_engineer.user_dow_dist.get(uid)
            lead = self.temporal_engineer.user_avg_lead_time.get(uid, 7.0)
            parts.append(hour if hour is not None else np.zeros(24, dtype=np.float32))
            parts.append(dow if dow is not None else np.zeros(7, dtype=np.float32))
            parts.append(np.array([lead], dtype=np.float32))

            # Engagement: 11 metrics
            eng = self.engagement_engineer.user_engagement.get(uid, {})
            parts.append(np.array([
                eng.get("total_activities", 0), eng.get("view_to_click_rate", 0),
                eng.get("click_to_book_rate", 0), eng.get("view_to_book_rate", 0),
                eng.get("avg_dwell_ms", 0) / 1000, eng.get("avg_session_duration_s", 0),
                eng.get("search_frequency", 0), eng.get("rec_impressions", 0),
                eng.get("rec_ctr", 0), eng.get("rec_conversion_rate", 0),
                eng.get("rec_dismissal_rate", 0),
            ], dtype=np.float32))

            # Interest: tag vector (top 50)
            int_vec = self.interest_similarity_engineer.user_interest_vecs.get(uid)
            parts.append(int_vec if int_vec is not None else np.zeros(
                max(len(self.interest_similarity_engineer.tag_vocab), 1), dtype=np.float32))

            # Participant: n_events, n_coattendees
            n_events = len(self.participant_engineer.user_event_sets.get(uid, set()))
            n_coattendees = len(self.participant_engineer.coattendee_graph.get(uid, {}))
            parts.append(np.array([float(n_events), float(n_coattendees)], dtype=np.float32))

            user_features[uid] = np.concatenate(parts).astype(np.float32)

        # ── Concatenate feature vectors per event ────────────────────
        for eid in all_event_ids:
            parts: List[np.ndarray] = []

            # Location
            eloc = self.location_engineer.event_location_profile.get(eid, {})
            if eloc:
                parts.append(np.array([
                    eloc.get("lat", 0), eloc.get("lon", 0),
                ], dtype=np.float32))
            else:
                parts.append(np.zeros(2, dtype=np.float32))

            # Collaborative: event factors + bias
            ef = self.collaborative_engineer.event_factors.get(eid)
            eb = self.collaborative_engineer.event_biases.get(eid, 0.0)
            if ef is not None:
                parts.append(ef)
                parts.append(np.array([eb], dtype=np.float32))
            else:
                parts.append(np.zeros(17, dtype=np.float32))

            # Interest: event tag vector
            etv = self.interest_similarity_engineer.event_tag_vecs.get(eid)
            parts.append(etv if etv is not None else np.zeros(
                max(len(self.interest_similarity_engineer.tag_vocab), 1), dtype=np.float32))

            # Participant: n_attendees
            n_attendees = len(self.participant_engineer.event_user_sets.get(eid, set()))
            parts.append(np.array([float(n_attendees)], dtype=np.float32))

            event_features[eid] = np.concatenate(parts).astype(np.float32)

        if not user_features or not event_features:
            logger.warning("No feature vectors built, skipping embedding training")
            return None

        # ── Build positive pairs from booking events ─────────────────
        positive_pairs: List[Tuple[str, str]] = []
        positive = booking_events[
            booking_events["type"].isin(["booking_confirmed", "booking_attended"])
        ]
        for _, row in positive.iterrows():
            uid = str(row.get("userId", ""))
            eid = str(row.get("eventId", ""))
            if uid in user_features and eid in event_features:
                positive_pairs.append((uid, eid))

        if len(positive_pairs) == 0:
            logger.warning("No valid positive pairs, skipping embedding training")
            return None

        logger.info(
            "Training embeddings from feature store: %d users (%d dims), %d events (%d dims), %d positive pairs",
            len(user_features),
            len(next(iter(user_features.values()))) if user_features else 0,
            len(event_features),
            len(next(iter(event_features.values()))) if event_features else 0,
            len(positive_pairs),
        )

        embedding_trainer = EmbeddingTrainer(
            output_path=os.path.join(self.output_path, "models"),
            embedding_dim=64,
        )
        embedding_trainer.train(user_features, event_features, positive_pairs)
        return embedding_trainer

    def _export_parquet(self, embedding_trainer: Any) -> None:
        """Export embeddings as Parquet files for pgvector bulk loading."""
        import json as json_mod

        try:
            import pyarrow as pa
            import pyarrow.parquet as pq
        except ImportError:
            logger.warning("pyarrow not installed, skipping Parquet export")
            return

        os.makedirs(self.output_path, exist_ok=True)

        # Event embeddings: [event_id, emb_0..63, metadata_json]
        event_rows = []
        for eid, emb in embedding_trainer.event_embeddings.items():
            row = {"event_id": eid}
            for i, val in enumerate(emb):
                row[f"emb_{i}"] = float(val)
            # Gather metadata from event catalog if available
            event_rows.append(row)

        if event_rows:
            event_path = os.path.join(self.output_path, "event_vectors.parquet")
            pq.write_table(pa.Table.from_pylist(event_rows), event_path)
            logger.info("Exported %d event embeddings to %s", len(event_rows), event_path)

        # User embeddings: [user_id, emb_0..63]
        user_rows = []
        for uid, emb in embedding_trainer.user_embeddings.items():
            row = {"user_id": uid}
            for i, val in enumerate(emb):
                row[f"emb_{i}"] = float(val)
            user_rows.append(row)

        if user_rows:
            user_path = os.path.join(self.output_path, "user_vectors.parquet")
            pq.write_table(pa.Table.from_pylist(user_rows), user_path)
            logger.info("Exported %d user embeddings to %s", len(user_rows), user_path)

    # ── Orchestration ─────────────────────────────────────────────────

    def run(self) -> None:
        """Execute the full ETLT pipeline."""
        start = datetime.now(timezone.utc)
        logger.info("=== Data Pipeline Start (mode=%s) at %s ===", self.mode, start.isoformat())

        raw_data = self.extract()
        if self.export_catalog:
            self._export_event_catalog(raw_data.get("event_lifecycle", pd.DataFrame()))
        features = self.transform(raw_data)
        self.load(features)
        embedding_trainer = self.train(features, raw_data)

        if embedding_trainer is not None:
            self._export_parquet(embedding_trainer)
            if os.getenv("BULK_LOAD_PGVECTOR", "0") == "1":
                from pgvector_loader import load_vectors_to_pgvector
                load_vectors_to_pgvector(self.output_path)

        elapsed = (datetime.now(timezone.utc) - start).total_seconds()
        logger.info("=== Data Pipeline Complete in %.1fs ===", elapsed)


if __name__ == "__main__":
    pipeline = DataPipeline(
        mode=os.getenv("PIPELINE_MODE", "incremental"),
        window_days=int(os.getenv("PIPELINE_WINDOW_DAYS", "30")),
        feature_store_url=os.getenv("FEATURE_STORE_URL", "redis://localhost:6379"),
        output_path=os.getenv("TRAINING_DATA_PATH", "/data/training"),
        export_catalog=os.getenv("EXPORT_EVENT_CATALOG", "0") == "1",
    )
    pipeline.run()
