// ── Location Context Events ─────────────────────────────────────────────
// Topic: location-context
// Captures location-specific signals for geo-based recommendation features.
// Enables: location popularity scoring, nearby event clustering,
// user mobility patterns, and venue affinity.
// Partition key: userId

export const LOCATION_CONTEXT_TOPIC = 'location-context';

export type LocationContextType =
  | 'location_search'
  | 'nearby_search'
  | 'map_pan'
  | 'map_zoom'
  | 'location_saved'
  | 'geofence_enter'
  | 'geofence_exit';

export interface LocationContextMessage {
  userId: string;
  sessionId: string;
  type: LocationContextType;
  timestamp: string; // ISO-8601

  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;         // GPS accuracy in meters
    city?: string;
    country?: string;
    postalCode?: string;
    neighborhood?: string;
  };

  // location_search, nearby_search
  search?: {
    query?: string;
    radiusKm: number;
    categories?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
    resultCount?: number;
    resultsReturned?: {
      eventId: string;
      category: string;
      distanceKm: number;
    }[];
  };

  // map_pan, map_zoom
  mapView?: {
    centerLatitude: number;
    centerLongitude: number;
    zoomLevel: number;
    boundsNE?: { latitude: number; longitude: number };
    boundsSW?: { latitude: number; longitude: number };
    visibleEventCount?: number;
  };

  // location_saved
  savedLocation?: {
    label: string;             // 'Home', 'Work', 'Gym area', etc.
    address: string;
  };

  // geofence_enter, geofence_exit
  geofence?: {
    geofenceId: string;
    geofenceName: string;      // e.g. 'Downtown', 'Arts District'
    eventDensity?: number;     // events per km² in this area
  };
}
