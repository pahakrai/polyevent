export declare const RECOMMENDATION_FEEDBACK_TOPIC = "recommendation-feedback";
export type RecommendationFeedbackType = 'impression' | 'click' | 'conversion' | 'dismiss';
export interface RecommendationFeedbackMessage {
    userId: string;
    sessionId: string;
    recommendationId: string;
    modelId: string;
    modelVersion: string;
    type: RecommendationFeedbackType;
    timestamp: string;
    placement: {
        page: string;
        widget: string;
        position?: number;
    };
    items: RecommendationItem[];
}
export interface RecommendationItem {
    eventId: string;
    position: number;
    score: number;
    eventCategory: string;
    eventGenres: string[];
    eventLocation: {
        city: string;
        country: string;
        latitude: number;
        longitude: number;
        distanceKm?: number;
    };
    interacted?: boolean;
    interactionType?: 'click' | 'bookmark' | 'book' | 'dismiss' | 'share';
    dwellTimeMs?: number;
}
