export declare const USER_ACTIVITY_TOPIC = "user-activities";
export type UserActivityType = 'page_view' | 'event_view' | 'event_save' | 'event_share' | 'click' | 'category_browse' | 'location_browse' | 'vendor_view' | 'vendor_follow' | 'session_start' | 'session_end';
export interface UserActivityMessage {
    userId: string;
    sessionId: string;
    type: UserActivityType;
    timestamp: string;
    pageUrl: string;
    referrer?: string;
    userAgent: string;
    ipAddress?: string;
    metadata: UserActivityMetadata;
}
export interface UserActivityMetadata {
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
    category?: string;
    subCategory?: string;
    location?: {
        latitude: number;
        longitude: number;
        radiusKm?: number;
        city?: string;
        country?: string;
    };
    clickTarget?: string;
    clickPosition?: number;
    sourceList?: string;
    vendorId?: string;
    vendorCategory?: string;
    shareMethod?: string;
    sessionDuration?: number;
    dwellTimeMs?: number;
    [key: string]: any;
}
