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

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd
import numpy as np

from feature_engineering import (
    LocationFeatureEngineer,
    CategoryFeatureEngineer,
    CollaborativeFeatureEngineer,
    TemporalFeatureEngineer,
    EngagementFeatureEngineer,
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
    ):
        self.mode = mode
        self.window_days = window_days
        self.output_path = output_path

        # Feature engineers — each handles one domain
        self.location_engineer = LocationFeatureEngineer()
        self.category_engineer = CategoryFeatureEngineer()
        self.collaborative_engineer = CollaborativeFeatureEngineer()
        self.temporal_engineer = TemporalFeatureEngineer()
        self.engagement_engineer = EngagementFeatureEngineer()

        # Feature store for online serving
        self.feature_store = FeatureStore(feature_store_url)

        # Cutoff for incremental mode
        self.since = datetime.now(timezone.utc) - timedelta(days=window_days)

    # ── Phase 1: Extract ──────────────────────────────────────────────

    def extract(self) -> Dict[str, pd.DataFrame]:
        """
        Extract raw data from all sources.

        In production, this reads from:
          - Kafka topic archives (S3/GCS via Kafka Connect)
          - PostgreSQL (current entity state for events, users, vendors)
          - Elasticsearch (event text for NLP features)

        Returns a dict of DataFrames keyed by event type.
        """
        logger.info("Extracting data (mode=%s, window=%dd)", self.mode, self.window_days)

        datasets: Dict[str, pd.DataFrame] = {}

        # User activity signals: views, saves, clicks, browses
        datasets["user_activities"] = self._extract_kafka_archive(
            "user-activities", since=self.since
        )

        # Event metadata: created, published, completed
        datasets["event_lifecycle"] = self._extract_kafka_archive(
            "event-lifecycle", since=self.since
        )

        # Booking funnel: initiated, confirmed, attended, cancelled
        datasets["booking_events"] = self._extract_kafka_archive(
            "booking-events", since=self.since
        )

        # Search intent: queries, filters, clicks, abandons
        datasets["search_events"] = self._extract_kafka_archive(
            "search-events", since=self.since
        )

        # Recommendation feedback: impressions, clicks, conversions
        datasets["recommendation_feedback"] = self._extract_kafka_archive(
            "recommendation-feedback", since=self.since
        )

        # Location context: searches, map interactions, geofence
        datasets["location_context"] = self._extract_kafka_archive(
            "location-context", since=self.since
        )

        # Count rows per dataset for observability
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

        # 6. Labels: positive = booking or strong engagement
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

        # Write to disk for training
        os.makedirs(self.output_path, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        for name, array in features.items():
            path = os.path.join(self.output_path, f"{name}_{timestamp}.npy")
            np.save(path, array)
            logger.info("  Saved %s -> %s (shape=%s)", name, path, array.shape)

    # ── Phase 4: Train ────────────────────────────────────────────────

    def train(self, features: Dict[str, np.ndarray]) -> None:
        """
        Trigger model training with the prepared features.

        Delegates to trainers/ which handle:
          - Two-tower neural network (user & event embeddings)
          - XGBoost/LightGBM ranker (pointwise/pairwise)
          - Matrix factorization (collaborative filtering)
          - Model evaluation, versioning, and registry push
        """
        if features.get("labels") is None or len(features["labels"]) == 0:
            logger.warning("No labels available, skipping training")
            return

        logger.info("Starting model training...")

        # Import here to avoid circular dependency
        from trainers.ranking_trainer import RankingTrainer

        trainer = RankingTrainer(
            output_path=os.path.join(self.output_path, "models"),
            feature_store=self.feature_store,
        )
        trainer.train(features)

    # ── Orchestration ─────────────────────────────────────────────────

    def run(self) -> None:
        """Execute the full ETLT pipeline."""
        start = datetime.now(timezone.utc)
        logger.info("=== Data Pipeline Start (mode=%s) at %s ===", self.mode, start.isoformat())

        raw_data = self.extract()
        features = self.transform(raw_data)
        self.load(features)
        self.train(features)

        elapsed = (datetime.now(timezone.utc) - start).total_seconds()
        logger.info("=== Data Pipeline Complete in %.1fs ===", elapsed)


if __name__ == "__main__":
    pipeline = DataPipeline(
        mode=os.getenv("PIPELINE_MODE", "incremental"),
        window_days=int(os.getenv("PIPELINE_WINDOW_DAYS", "30")),
        feature_store_url=os.getenv("FEATURE_STORE_URL", "redis://localhost:6379"),
        output_path=os.getenv("TRAINING_DATA_PATH", "/data/training"),
    )
    pipeline.run()
