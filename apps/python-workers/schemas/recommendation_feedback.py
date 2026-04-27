"""Recommendation feedback schemas — mirrors libs/kafka-client/src/schemas/recommendation-feedback.schema.ts."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

RECOMMENDATION_FEEDBACK_TOPIC = "recommendation-feedback"

RecommendationFeedbackType = Literal[
    "impression",
    "click",
    "conversion",
    "dismiss",
]


class Placement(BaseModel):
    page: str  # 'home', 'event_detail', 'search_results', 'booking_confirmation'
    widget: str  # 'you_may_like', 'nearby_events', 'similar_events', 'trending'
    position: Optional[int] = None


class RecItemLocation(BaseModel):
    city: str
    country: str
    latitude: float
    longitude: float
    distanceKm: Optional[float] = None


class RecommendationItem(BaseModel):
    eventId: str
    position: int
    score: float
    eventCategory: str
    eventGenres: List[str]
    eventLocation: RecItemLocation
    interacted: Optional[bool] = None
    interactionType: Optional[Literal["click", "bookmark", "book", "dismiss", "share"]] = None
    dwellTimeMs: Optional[int] = None


class RecommendationFeedbackMessage(BaseModel):
    userId: str
    sessionId: str
    recommendationId: str
    modelId: str
    modelVersion: str
    type: RecommendationFeedbackType
    timestamp: datetime
    placement: Placement
    items: List[RecommendationItem]
