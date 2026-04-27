"""Event lifecycle schemas — mirrors libs/kafka-client/src/schemas/event-lifecycle.schema.ts."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

EVENT_LIFECYCLE_TOPIC = "event-lifecycle"

EventLifecycleType = Literal[
    "event_created",
    "event_updated",
    "event_published",
    "event_cancelled",
    "event_completed",
    "event_sold_out",
    "event_rescheduled",
]


class RecurrencePattern(BaseModel):
    frequency: Literal["daily", "weekly", "monthly"]
    interval: int = 1
    daysOfWeek: Optional[List[int]] = None


class EventSchedule(BaseModel):
    startDate: datetime
    endDate: datetime
    timezone: str
    recurrence: Optional[RecurrencePattern] = None


class EventLocation(BaseModel):
    venueName: str
    address: str
    city: str
    country: str
    latitude: float
    longitude: float


class EventPricing(BaseModel):
    minPrice: float
    maxPrice: float
    currency: str


class EventSnapshot(BaseModel):
    title: str
    description: str
    category: str
    subCategory: Optional[str] = None
    genres: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    location: EventLocation
    schedule: EventSchedule
    pricing: EventPricing
    capacity: int
    ageRestriction: Optional[str] = None
    images: List[str] = Field(default_factory=list)


class EventLifecycleMessage(BaseModel):
    eventId: str
    vendorId: str
    type: EventLifecycleType
    timestamp: datetime
    event: EventSnapshot
    changedFields: Optional[List[str]] = None
