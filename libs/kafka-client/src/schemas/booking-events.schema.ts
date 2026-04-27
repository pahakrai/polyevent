// ── Booking Events ──────────────────────────────────────────────────────
// Topic: booking-events
// Captures the booking funnel — the strongest positive signal for
// collaborative filtering and user preference modeling.
// Partition key: userId

export const BOOKING_EVENTS_TOPIC = 'booking-events';

export type BookingEventType =
  | 'booking_initiated'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_attended'
  | 'booking_no_show'
  | 'booking_refunded';

export interface BookingEventMessage {
  bookingId: string;
  userId: string;
  eventId: string;
  vendorId: string;
  type: BookingEventType;
  timestamp: string; // ISO-8601

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

  // For attended/no_show — post-event feedback signal
  attendeeRating?: number;    // 1-5
  attendeeReview?: string;

  // Source attribution
  source?: {
    channel: string;          // 'search', 'recommendation', 'direct', 'vendor_page', 'social'
    searchQuery?: string;
    recommendationId?: string;
    recommendationModel?: string;
  };

  // Cancellation context
  cancellationReason?: string;
  refundAmount?: number;
}
