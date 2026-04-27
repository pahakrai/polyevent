"""Search event schemas — mirrors libs/kafka-client/src/schemas/search-events.schema.ts."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

SEARCH_EVENTS_TOPIC = "search-events"

SearchEventType = Literal[
    "search_performed",
    "search_result_clicked",
    "search_abandoned",
]


class SearchLocation(BaseModel):
    latitude: float
    longitude: float
    radiusKm: float
    city: Optional[str] = None
    country: Optional[str] = None


class SearchDateRange(BaseModel):
    start: str
    end: str


class SearchPriceRange(BaseModel):
    min: float
    max: float
    currency: str


class SearchFilters(BaseModel):
    category: Optional[List[str]] = None
    subCategory: Optional[List[str]] = None
    genres: Optional[List[str]] = None
    eventType: Optional[List[str]] = None
    location: Optional[SearchLocation] = None
    dateRange: Optional[SearchDateRange] = None
    priceRange: Optional[SearchPriceRange] = None


class SearchDetail(BaseModel):
    query: str
    normalizedQuery: str
    filters: SearchFilters
    resultCount: int
    page: int


class ClickLocation(BaseModel):
    latitude: float
    longitude: float
    city: str
    distanceKm: Optional[float] = None


class ClickDetail(BaseModel):
    eventId: str
    eventCategory: str
    eventGenres: List[str]
    position: int
    page: int
    eventLocation: ClickLocation


class AbandonDetail(BaseModel):
    resultsShown: int
    timeOnPageMs: int


class SearchEventMessage(BaseModel):
    userId: str
    sessionId: str
    searchId: str
    type: SearchEventType
    timestamp: datetime
    search: Optional[SearchDetail] = None
    click: Optional[ClickDetail] = None
    abandon: Optional[AbandonDetail] = None
