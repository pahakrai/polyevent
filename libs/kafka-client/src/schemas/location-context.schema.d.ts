export declare const LOCATION_CONTEXT_TOPIC = "location-context";
export type LocationContextType = 'location_search' | 'nearby_search' | 'map_pan' | 'map_zoom' | 'location_saved' | 'geofence_enter' | 'geofence_exit';
export interface LocationContextMessage {
    userId: string;
    sessionId: string;
    type: LocationContextType;
    timestamp: string;
    location: {
        latitude: number;
        longitude: number;
        accuracy?: number;
        city?: string;
        country?: string;
        postalCode?: string;
        neighborhood?: string;
    };
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
    mapView?: {
        centerLatitude: number;
        centerLongitude: number;
        zoomLevel: number;
        boundsNE?: {
            latitude: number;
            longitude: number;
        };
        boundsSW?: {
            latitude: number;
            longitude: number;
        };
        visibleEventCount?: number;
    };
    savedLocation?: {
        label: string;
        address: string;
    };
    geofence?: {
        geofenceId: string;
        geofenceName: string;
        eventDensity?: number;
    };
}
