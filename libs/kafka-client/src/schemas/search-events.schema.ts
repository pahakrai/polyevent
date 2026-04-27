// ── Search Events ───────────────────────────────────────────────────────
// Topic: search-events
// Captures search intent with full filter context for learning user
// location and category preferences from explicit queries.
// Partition key: userId

export const SEARCH_EVENTS_TOPIC = 'search-events';

export type SearchEventType =
  | 'search_performed'
  | 'search_result_clicked'
  | 'search_abandoned';

export interface SearchEventMessage {
  userId: string;
  sessionId: string;
  searchId: string;          // UUID to correlate search → click → conversion
  type: SearchEventType;
  timestamp: string; // ISO-8601

  // search_performed
  search?: {
    query: string;
    normalizedQuery: string;  // lowercased, stemmed
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

  // search_result_clicked
  click?: {
    eventId: string;
    eventCategory: string;
    eventGenres: string[];
    position: number;          // 1-indexed position in results
    page: number;
    eventLocation: {
      latitude: number;
      longitude: number;
      city: string;
      distanceKm?: number;     // distance from search center
    };
  };

  // search_abandoned
  abandon?: {
    resultsShown: number;
    timeOnPageMs: number;     // how long before leaving without clicking
  };
}
