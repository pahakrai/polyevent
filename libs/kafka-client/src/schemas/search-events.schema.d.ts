export declare const SEARCH_EVENTS_TOPIC = "search-events";
export type SearchEventType = 'search_performed' | 'search_result_clicked' | 'search_abandoned';
export interface SearchEventMessage {
    userId: string;
    sessionId: string;
    searchId: string;
    type: SearchEventType;
    timestamp: string;
    search?: {
        query: string;
        normalizedQuery: string;
        filters: {
            category?: string[];
            subCategory?: string[];
            genres?: string[];
            eventType?: string[];
            location?: {
                latitude: number;
                longitude: number;
                radiusKm: number;
                city?: string;
                country?: string;
            };
            dateRange?: {
                start: string;
                end: string;
            };
            priceRange?: {
                min: number;
                max: number;
                currency: string;
            };
        };
        resultCount: number;
        page: number;
    };
    click?: {
        eventId: string;
        eventCategory: string;
        eventGenres: string[];
        position: number;
        page: number;
        eventLocation: {
            latitude: number;
            longitude: number;
            city: string;
            distanceKm?: number;
        };
    };
    abandon?: {
        resultsShown: number;
        timeOnPageMs: number;
    };
}
