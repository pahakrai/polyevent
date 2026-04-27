"""Booking event schemas — mirrors libs/kafka-client/src/schemas/booking-events.schema.ts."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

BOOKING_EVENTS_TOPIC = "booking-events"

BookingEventType = Literal[
    "booking_initiated",
    "booking_confirmed",
    "booking_cancelled",
    "booking_attended",
    "booking_no_show",
    "booking_refunded",
]


class TicketLine(BaseModel):
    tier: str
    quantity: int
    unitPrice: float


class BookingDetail(BaseModel):
    tickets: List[TicketLine]
    totalAmount: float
    currency: str
    status: str


class BookingEventBrief(BaseModel):
    title: str
    category: str
    subCategory: Optional[str] = None
    genres: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    startTime: datetime
    endTime: datetime
    location: BookingLocation


class BookingLocation(BaseModel):
    venueName: str
    city: str
    country: str
    latitude: float
    longitude: float


class BookingSource(BaseModel):
    channel: str  # 'search', 'recommendation', 'direct', 'vendor_page', 'social'
    searchQuery: Optional[str] = None
    recommendationId: Optional[str] = None
    recommendationModel: Optional[str] = None


class BookingEventMessage(BaseModel):
    bookingId: str
    userId: str
    eventId: str
    vendorId: str
    type: BookingEventType
    timestamp: datetime
    booking: BookingDetail
    event: BookingEventBrief
    attendeeRating: Optional[int] = None
    attendeeReview: Optional[str] = None
    source: Optional[BookingSource] = None
    cancellationReason: Optional[str] = None
    refundAmount: Optional[float] = None
