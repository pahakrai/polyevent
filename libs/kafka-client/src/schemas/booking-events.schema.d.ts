export declare const BOOKING_EVENTS_TOPIC = "booking-events";
export type BookingEventType = 'booking_initiated' | 'booking_confirmed' | 'booking_cancelled' | 'booking_attended' | 'booking_no_show' | 'booking_refunded';
export interface BookingEventMessage {
    bookingId: string;
    userId: string;
    eventId: string;
    vendorId: string;
    type: BookingEventType;
    timestamp: string;
    booking: {
        tickets: {
            tier: string;
            quantity: number;
            unitPrice: number;
        }[];
        totalAmount: number;
        currency: string;
        status: string;
    };
    event: {
        title: string;
        category: string;
        subCategory?: string;
        genres: string[];
        tags: string[];
        startTime: string;
        endTime: string;
        location: {
            venueName: string;
            city: string;
            country: string;
            latitude: number;
            longitude: number;
        };
    };
    attendeeRating?: number;
    attendeeReview?: string;
    source?: {
        channel: string;
        searchQuery?: string;
        recommendationId?: string;
        recommendationModel?: string;
    };
    cancellationReason?: string;
    refundAmount?: number;
}
