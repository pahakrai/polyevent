export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  tickets: Ticket[];
  totalAmount: number;
  currency: string;
  status: BookingStatus;
  payment: PaymentInfo;
  attendees?: Attendee[];
  cancellation?: CancellationInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  ticketId: string;
  type: string;
  price: number;
  quantity: number;
  attendeeName?: string;
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'cancelled'
  | 'refunded'
  | 'expired';

export interface PaymentInfo {
  method: PaymentMethod;
  transactionId?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paidAt?: Date;
  refundedAt?: Date;
}

export type PaymentMethod = 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'bank_transfer';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Attendee {
  name: string;
  email: string;
  phone?: string;
  specialRequirements?: string;
}

export interface CancellationInfo {
  reason: string;
  cancelledBy: 'user' | 'vendor' | 'system';
  cancelledAt: Date;
  refundAmount: number;
  refundStatus: 'pending' | 'processed' | 'failed';
}

export interface BookingSearchCriteria {
  userId?: string;
  eventId?: string;
  vendorId?: string;
  status?: BookingStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  page: number;
  limit: number;
}

export interface BookingAnalytics {
  totalBookings: number;
  totalRevenue: number;
  averageTicketPrice: number;
  cancellationRate: number;
  popularEvents: Array<{
    eventId: string;
    bookingsCount: number;
  }>;
  timeline: Array<{
    date: string;
    bookings: number;
    revenue: number;
  }>;
}