export interface UserActivityMessage {
  userId: string;
  sessionId: string;
  type: string;
  timestamp: string;
  pageUrl: string;
  referrer?: string;
  userAgent: string;
  ipAddress?: string;
  metadata: {
    eventId?: string;
    searchQuery?: string;
    filters?: Record<string, any>;
    bookingId?: string;
    vendorId?: string;
    [key: string]: any;
  };
}

export const USER_ACTIVITY_TOPIC = 'user-activities';