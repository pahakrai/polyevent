export interface Event {
  id: string;
  title: string;
  description: string;
  type: EventType;
  genre: string;
  vendorId: string;
  location: EventLocation;
  schedule: EventSchedule;
  pricing: Pricing[];
  capacity: number;
  bookedCount: number;
  images: string[];
  status: EventStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type EventType = 'concert' | 'workshop' | 'jam_session' | 'open_mic' | 'festival' | 'private_lesson';

export interface EventLocation {
  venueName: string;
  address: string;
  city: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface EventSchedule {
  startDate: Date;
  endDate: Date;
  recurrence?: RecurrencePattern;
  timezone: string;
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek?: number[];
  endDate?: Date;
}

export interface Pricing {
  tier: string;
  price: number;
  currency: string;
  features: string[];
  availableTickets: number;
}

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'sold_out' | 'ongoing' | 'completed';

export interface EventSearchFilters {
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  genres?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  eventTypes?: EventType[];
  query?: string;
  page: number;
  limit: number;
}