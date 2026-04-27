"""User activity event schemas — mirrors libs/kafka-client/src/schemas/user-activity.schema.ts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

USER_ACTIVITY_TOPIC = "user-activities"

UserActivityType = Literal[
    "page_view",
    "event_view",
    "event_save",
    "event_share",
    "click",
    "category_browse",
    "location_browse",
    "vendor_view",
    "vendor_follow",
    "session_start",
    "session_end",
]


class EventLocationBrief(BaseModel):
    latitude: float
    longitude: float
    city: str
    country: str


class LocationBrief(BaseModel):
    latitude: float
    longitude: float
    radiusKm: Optional[float] = None
    city: Optional[str] = None
    country: Optional[str] = None


class UserActivityMetadata(BaseModel):
    eventId: Optional[str] = None
    eventCategory: Optional[str] = None
    eventSubCategory: Optional[str] = None
    eventGenres: Optional[List[str]] = None
    eventLocation: Optional[EventLocationBrief] = None
    category: Optional[str] = None
    subCategory: Optional[str] = None
    location: Optional[LocationBrief] = None
    clickTarget: Optional[str] = None
    clickPosition: Optional[int] = None
    sourceList: Optional[str] = None
    vendorId: Optional[str] = None
    vendorCategory: Optional[str] = None
    shareMethod: Optional[str] = None
    sessionDuration: Optional[float] = None
    dwellTimeMs: Optional[int] = None

    class Config:
        extra = "allow"


class UserActivityMessage(BaseModel):
    userId: str
    sessionId: str
    type: UserActivityType
    timestamp: datetime
    pageUrl: str
    referrer: Optional[str] = None
    userAgent: str
    ipAddress: Optional[str] = None
    metadata: UserActivityMetadata = Field(default_factory=UserActivityMetadata)
