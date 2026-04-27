export declare const EVENT_LIFECYCLE_TOPIC = "event-lifecycle";
export type EventLifecycleType = 'event_created' | 'event_updated' | 'event_published' | 'event_cancelled' | 'event_completed' | 'event_sold_out' | 'event_rescheduled';
export interface EventLifecycleMessage {
    eventId: string;
    vendorId: string;
    type: EventLifecycleType;
    timestamp: string;
    event: {
        title: string;
        description: string;
        category: string;
        subCategory?: string;
        genres: string[];
        tags: string[];
        location: {
            venueName: string;
            address: string;
            city: string;
            country: string;
            latitude: number;
            longitude: number;
        };
        schedule: {
            startDate: string;
            endDate: string;
            timezone: string;
            recurrence?: {
                frequency: 'daily' | 'weekly' | 'monthly';
                interval: number;
                daysOfWeek?: number[];
            };
        };
        pricing: {
            minPrice: number;
            maxPrice: number;
            currency: string;
        };
        capacity: number;
        ageRestriction?: string;
        images: string[];
    };
    changedFields?: string[];
}
