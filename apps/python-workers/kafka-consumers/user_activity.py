#!/usr/bin/env python3
"""
Kafka consumer for processing user activity and recommendation signal events.

Consumes from 6 topics and routes to the feature engineering pipeline.
Designed for horizontal scaling: run multiple instances in the same consumer
group for parallel partition processing.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from confluent_kafka import Consumer, KafkaError, KafkaException, TopicPartition
from confluent_kafka.admin import AdminClient, NewTopic

# Schemas for typed message parsing
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from schemas.user_activity import UserActivityMessage, USER_ACTIVITY_TOPIC
from schemas.event_lifecycle import EventLifecycleMessage, EVENT_LIFECYCLE_TOPIC
from schemas.booking_events import BookingEventMessage, BOOKING_EVENTS_TOPIC
from schemas.search_events import SearchEventMessage, SEARCH_EVENTS_TOPIC
from schemas.recommendation_feedback import (
    RecommendationFeedbackMessage,
    RECOMMENDATION_FEEDBACK_TOPIC,
)
from schemas.location_context import LocationContextMessage, LOCATION_CONTEXT_TOPIC

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("kafka-consumer")


# ── Topic configuration ──────────────────────────────────────────────────

TOPICS = [
    USER_ACTIVITY_TOPIC,
    EVENT_LIFECYCLE_TOPIC,
    BOOKING_EVENTS_TOPIC,
    SEARCH_EVENTS_TOPIC,
    RECOMMENDATION_FEEDBACK_TOPIC,
    LOCATION_CONTEXT_TOPIC,
]

TOPIC_PARTITIONS = {t: 6 for t in TOPICS}  # 6 partitions per topic for parallelism
REPLICATION_FACTOR = int(os.getenv("KAFKA_REPLICATION_FACTOR", "1"))

# Schema routing: which Pydantic model to parse each topic's messages
SCHEMA_REGISTRY: Dict[str, type] = {
    USER_ACTIVITY_TOPIC: UserActivityMessage,
    EVENT_LIFECYCLE_TOPIC: EventLifecycleMessage,
    BOOKING_EVENTS_TOPIC: BookingEventMessage,
    SEARCH_EVENTS_TOPIC: SearchEventMessage,
    RECOMMENDATION_FEEDBACK_TOPIC: RecommendationFeedbackMessage,
    LOCATION_CONTEXT_TOPIC: LocationContextMessage,
}


class UserActivityConsumer:
    """Consumes recommendation-relevant events and dispatches to feature processors."""

    def __init__(
        self,
        bootstrap_servers: str = "localhost:9092",
        group_id: str = "python-workers",
        feature_store_url: Optional[str] = None,
    ):
        self.bootstrap_servers = bootstrap_servers
        self.group_id = group_id
        self.feature_store_url = feature_store_url
        self.consumer: Optional[Consumer] = None
        self.running = False
        self.handlers: Dict[str, Callable] = {}

    # ── Kafka lifecycle ───────────────────────────────────────────────

    def connect(self) -> None:
        conf = {
            "bootstrap.servers": self.bootstrap_servers,
            "group.id": self.group_id,
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
            "max.poll.interval.ms": 300_000,  # 5 min for ML processing
            "session.timeout.ms": 45_000,
            "heartbeat.interval.ms": 10_000,
            "partition.assignment.strategy": "cooperative-sticky",
        }
        self.consumer = Consumer(conf)
        logger.info("Connected to Kafka at %s (group: %s)", self.bootstrap_servers, self.group_id)

    def ensure_topics(self) -> None:
        """Create topics if they don't exist (dev convenience)."""
        admin = AdminClient({"bootstrap.servers": self.bootstrap_servers})
        existing = set(admin.list_topics(timeout=10).topics.keys())
        missing = [t for t in TOPICS if t not in existing]
        if not missing:
            return
        logger.info("Creating topics: %s", missing)
        new_topics = [
            NewTopic(t, num_partitions=TOPIC_PARTITIONS[t], replication_factor=REPLICATION_FACTOR)
            for t in missing
        ]
        futures = admin.create_topics(new_topics)
        for topic, future in futures.items():
            try:
                future.result()
                logger.info("Created topic: %s", topic)
            except Exception as e:
                if "already exists" not in str(e):
                    logger.error("Failed to create topic %s: %s", topic, e)

    def subscribe(self) -> None:
        if self.consumer is None:
            raise RuntimeError("Not connected. Call connect() first.")
        self.consumer.subscribe(TOPICS)
        logger.info("Subscribed to topics: %s", TOPICS)

    # ── Handler registration ──────────────────────────────────────────

    def register_handler(self, topic: str, handler: Callable[[Any], None]) -> None:
        self.handlers[topic] = handler

    # ── Message processing ────────────────────────────────────────────

    def process_message(self, topic: str, raw_value: bytes) -> None:
        """Parse, validate, and route a message to the registered handler."""
        try:
            data = json.loads(raw_value.decode("utf-8"))
        except json.JSONDecodeError:
            logger.warning("Skipping malformed JSON on topic %s", topic)
            return

        # Validate with Pydantic schema if available
        schema_cls = SCHEMA_REGISTRY.get(topic)
        if schema_cls:
            try:
                parsed = schema_cls(**data)
            except Exception as e:
                logger.warning("Schema validation failed for %s: %s", topic, e)
                return
        else:
            parsed = data

        # Dispatch to registered handler
        handler = self.handlers.get(topic)
        if handler:
            try:
                handler(parsed)
            except Exception:
                logger.exception("Handler for %s failed", topic)
        else:
            logger.debug("No handler for topic %s, message dropped", topic)

    # ── Main loop ─────────────────────────────────────────────────────

    def run(self) -> None:
        self.ensure_topics()
        self.connect()
        self.subscribe()
        self.running = True

        signal.signal(signal.SIGINT, self._shutdown)
        signal.signal(signal.SIGTERM, self._shutdown)

        logger.info("Starting consumer loop on %d topics", len(TOPICS))

        batch: List[Any] = []
        batch_size = int(os.getenv("BATCH_SIZE", "100"))
        batch_timeout_ms = int(os.getenv("BATCH_TIMEOUT_MS", "5000"))
        last_batch_time = datetime.now(timezone.utc)

        try:
            while self.running:
                msg = self.consumer.poll(1.0)

                if msg is None:
                    self._flush_batch_if_due(batch, last_batch_time, batch_timeout_ms)
                    continue

                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    logger.error("Kafka error: %s", msg.error())
                    continue

                self.process_message(msg.topic(), msg.value())
                self.consumer.commit(message=msg, asynchronous=True)

        except KafkaException as e:
            logger.exception("Kafka exception: %s", e)
        finally:
            self.close()

    def _flush_batch_if_due(self, batch: List[Any], last_batch: datetime, timeout_ms: int) -> None:
        if batch and (datetime.now(timezone.utc) - last_batch).total_seconds() * 1000 > timeout_ms:
            self._flush_batch(batch)

    def _flush_batch(self, batch: List[Any]) -> None:
        batch.clear()

    def _shutdown(self, signum: int, frame: Any) -> None:
        logger.info("Received signal %d, shutting down", signum)
        self.running = False

    def close(self) -> None:
        self.running = False
        if self.consumer:
            try:
                self.consumer.close()
                logger.info("Kafka consumer closed")
            except Exception:
                pass


# ── Entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    consumer = UserActivityConsumer(
        bootstrap_servers=os.getenv("KAFKA_BROKERS", "localhost:9092"),
        group_id=os.getenv("KAFKA_CONSUMER_GROUP", "python-workers"),
    )
    consumer.run()
