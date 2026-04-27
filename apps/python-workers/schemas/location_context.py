"""Location context schemas — mirrors libs/kafka-client/src/schemas/location-context.schema.ts."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

LOCATION_CONTEXT_TOPIC = "location-context"

LocationContextType = Literal[
    "location_search",
    "nearby_search",
    "map_pan",
    "map_zoom",
    "location_saved",
    "geofence_enter",
    "geofence_exit",
]


class GeoPoint(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    city: Optional[str] = None
    country: Optional[str] = None
    postalCode: Optional[str] = None
    neighborhood: Optional[str] = None


class LocationSearchResult(BaseModel):
    eventId: str
    category: str
    distanceKm: float


class LocationSearch(BaseModel):
    query: Optional[str] = None
    radiusKm: float
    categories: Optional[List[str]] = None
    dateRange: Optional[LocationDateRange] = None
    resultCount: Optional[int] = None
    resultsReturned: Optional[List[LocationSearchResult]] = None


class LocationDateRange(BaseModel):
    start: str
    end: str


class Bounds(BaseModel):
    latitude: float
    longitude: float


class MapView(BaseModel):
    centerLatitude: float
    centerLongitude: float
    zoomLevel: float
    boundsNE: Optional[Bounds] = None
    boundsSW: Optional[Bounds] = None
    visibleEventCount: Optional[int] = None


class SavedLocation(BaseModel):
    label: str  # 'Home', 'Work', 'Gym area', etc.
    address: str


class Geofence(BaseModel):
    geofenceId: str
    geofenceName: str  # e.g. 'Downtown', 'Arts District'
    eventDensity: Optional[float] = None  # events per km²


class LocationContextMessage(BaseModel):
    userId: str
    sessionId: str
    type: LocationContextType
    timestamp: datetime
    location: GeoPoint
    search: Optional[LocationSearch] = None
    mapView: Optional[MapView] = None
    savedLocation: Optional[SavedLocation] = None
    geofence: Optional[Geofence] = None
