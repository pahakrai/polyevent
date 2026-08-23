// ─────────────────────────────────────────────────────────────────────────────
// Dynamic event types
//
// The platform supports arbitrary event categories (music, art, sports,
// activities, ...). Each event references a configurable `EventTypeDefinition`
// and carries type-specific data in `attributes`, whose shape is described by
// the type's `attributesSchema` (a JSON Schema fragment).
// ─────────────────────────────────────────────────────────────────────────────

export type EventCategory =
  | 'MUSIC'
  | 'ART'
  | 'SPORTS'
  | 'ACTIVITIES'
  | 'OTHER'
  | (string & {});

/** A configurable event type (admin-managed). */
export interface EventTypeDefinition {
  id: string;
  /** Stable, URL-friendly identifier, e.g. "jam_session", "art_class". */
  slug: string;
  name: string;
  description?: string;
  category: EventCategory;
  icon?: string;
  /** JSON Schema fragment describing the shape of `Event.attributes`. */
  attributesSchema?: Record<string, unknown>;
  /** Whether attendees can RSVP (collaborative/session-style types). */
  allowRsvp?: boolean;
  isActive?: boolean;
}

/** Type-specific event data (validated against the type's attributesSchema). */
export type EventAttributes = Record<string, unknown>;

export interface Event {
  id: string;
  title: string;
  description: string;
  eventTypeId: string;
  eventTypeSlug: string;
  category: EventCategory;
  attributes: EventAttributes;
  tags: string[];
  vendorId?: string;
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
  categories?: EventCategory[];
  tags?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  eventTypeSlugs?: string[];
  query?: string;
  page: number;
  limit: number;
}
