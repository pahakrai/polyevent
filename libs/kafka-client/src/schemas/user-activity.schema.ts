// ── User Activity Events ───────────────────────────────────────────────
// Topic: user-activities
// Captures raw behavioral signals for collaborative + content-based features.
// Partition key: userId

export const USER_ACTIVITY_TOPIC = 'user-activities';

export type UserActivityType =
  | 'page_view'
  | 'event_view'
  | 'event_save'
  | 'event_share'
  | 'click'
  | 'category_browse'
  | 'location_browse'
  | 'vendor_view'
  | 'vendor_follow'
  | 'session_start'
  | 'session_end';

export interface UserActivityMessage {
  userId: string;
  sessionId: string;
  type: UserActivityType;
  timestamp: string; // ISO-8601
  pageUrl: string;
  referrer?: string;
  userAgent: string;
  ipAddress?: string;

  // Context varies by event type
  metadata: UserActivityMetadata;
}

export interface UserActivityMetadata {
  // event_view, event_save, event_share, click
  eventId?: string;
  eventCategory?: string;
  eventSubCategory?: string;
  eventGenres?: string[];
  eventLocation?: {
    latitude: number;
    longitude: number;
    city: string;
    country: string;
  };

  // category_browse
  category?: string;
  subCategory?: string;

  // location_browse
  location?: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
    city?: string;
    country?: string;
  };

  // click
  clickTarget?: string;       // e.g. 'event_card', 'recommendation_widget', 'map_pin'
  clickPosition?: number;     // position in list (1-indexed)
  sourceList?: string;        // 'search_results', 'recommendations', 'trending', 'nearby'

  // vendor_view, vendor_follow
  vendorId?: string;
  vendorCategory?: string;

  // event_save, event_share
  shareMethod?: string;       // 'copy_link', 'social', 'messaging'

  // session_start, session_end
  sessionDuration?: number;   // seconds

  // Duration on page (event_view, category_browse)
  dwellTimeMs?: number;

  // Catch-all for future extensions
  [key: string]: any;
}
