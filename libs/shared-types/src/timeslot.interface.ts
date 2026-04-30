export interface TimeSlot {
  id: string;
  venueId: string;
  startTime: string;
  endTime: string;
  status: TimeSlotStatus;
  recurrenceRule?: string;
  priceOverride?: TimeSlotPriceOverride;
  maxBookings: number;
  createdAt: string;
  updatedAt: string;
}

export type TimeSlotStatus = 'available' | 'booked' | 'blocked' | 'maintenance';

export interface TimeSlotPriceOverride {
  amount: number;
  currency: string;
}

export interface CreateTimeSlotRequest {
  venueId: string;
  startTime: string;
  endTime: string;
  status?: TimeSlotStatus;
  recurrenceRule?: string;
  priceOverride?: TimeSlotPriceOverride;
  maxBookings?: number;
}

export interface BulkCreateTimeSlotRequest {
  venueId: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  priceOverride?: TimeSlotPriceOverride;
}
