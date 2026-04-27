// ── Recommendation Feedback Events ──────────────────────────────────────
// Topic: recommendation-feedback
// Closed-loop feedback for training and evaluating recommendation models.
// Captures the full funnel: impression → click → conversion → dismiss.
// Partition key: userId

export const RECOMMENDATION_FEEDBACK_TOPIC = 'recommendation-feedback';

export type RecommendationFeedbackType =
  | 'impression'
  | 'click'
  | 'conversion'
  | 'dismiss';

export interface RecommendationFeedbackMessage {
  userId: string;
  sessionId: string;
  recommendationId: string;   // UUID for this recommendation request
  modelId: string;            // which model version served the rec
  modelVersion: string;
  type: RecommendationFeedbackType;
  timestamp: string; // ISO-8601

  // The context in which recommendations were shown
  placement: {
    page: string;             // 'home', 'event_detail', 'search_results', 'booking_confirmation'
    widget: string;           // 'you_may_like', 'nearby_events', 'similar_events', 'trending'
    position?: number;        // position within the widget
  };

  // The recommended items that were shown / interacted with
  items: RecommendationItem[];
}

export interface RecommendationItem {
  eventId: string;
  position: number;           // 1-indexed display position
  score: number;              // model's relevance score
  eventCategory: string;
  eventGenres: string[];
  eventLocation: {
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    distanceKm?: number;
  };

  // Interaction signals (which items were clicked, booked, dismissed)
  interacted?: boolean;
  interactionType?: 'click' | 'bookmark' | 'book' | 'dismiss' | 'share';
  dwellTimeMs?: number;       // how long user viewed this item
}
