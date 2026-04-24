// Shared seed data definitions for consistent seeding across services

// User emails (must match across auth, user, vendor services)
export const SEED_USER_EMAILS = {
  ADMIN: 'admin@example.com',
  REGULAR: 'user@example.com',
  VENDOR: 'vendor@example.com',
} as const;

// User names
export const SEED_USER_NAMES = {
  ADMIN: { firstName: 'Admin', lastName: 'User' },
  REGULAR: { firstName: 'Regular', lastName: 'User' },
  VENDOR: { firstName: 'Vendor', lastName: 'Owner' },
} as const;

// Vendor business details
export const SEED_VENDOR_DETAILS = {
  BUSINESS_NAME: 'LA Music Hall',
  DESCRIPTION: 'Premier music venue in Los Angeles',
  CATEGORY: 'MUSIC_VENUE' as const,
  CONTACT_EMAIL: 'info@lamusichall.com',
  CONTACT_PHONE: '+1-555-123-4567',
  WEBSITE: 'https://lamusichall.com',
} as const;

// Venue details
export const SEED_VENUE_DETAILS = {
  NAME: 'Main Concert Hall',
  DESCRIPTION: 'Spacious concert hall with excellent acoustics',
  TYPE: 'CONCERT_HALL' as const,
  CAPACITY: 500,
  HOURLY_RATE: 250.0,
} as const;

// Address and location (consistent across vendor, venue, events)
export const SEED_LOCATION = {
  STREET: '123 Music Ave',
  CITY: 'Los Angeles',
  STATE: 'CA',
  ZIP: '90001',
  COORDINATES: { longitude: -118.2437, latitude: 34.0522 },
} as const;

// Event details
export const SEED_EVENTS = [
  {
    title: 'Jazz Night Live',
    description: 'An evening of smooth jazz with local artists',
    category: 'CONCERT' as const,
    subCategory: 'Jazz',
    price: { general: 25.0, vip: 50.0, currency: 'USD' as const },
    maxAttendees: 200,
    tags: ['jazz', 'live music', 'weekend'],
    ageRestriction: 21,
  },
  {
    title: 'Rock Guitar Workshop',
    description: 'Learn rock guitar techniques from professional musicians',
    category: 'WORKSHOP' as const,
    subCategory: 'Music Education',
    price: { general: 40.0, student: 30.0, currency: 'USD' as const },
    maxAttendees: 30,
    tags: ['workshop', 'guitar', 'education'],
    ageRestriction: 16,
    isRecurring: true,
    recurringRule: 'WEEKLY' as const,
  },
] as const;

// Default hardcoded IDs (for backward compatibility)
export const DEFAULT_HARDCODED_IDS = {
  VENDOR_USER_ID: 'vendor-user-id-123',
  VENDOR_ID: 'vendor-id-123',
  VENUE_ID: 'venue-id-123',
} as const;

// Helper to get address object
export function getAddress() {
  return {
    street: SEED_LOCATION.STREET,
    city: SEED_LOCATION.CITY,
    state: SEED_LOCATION.STATE,
    zip: SEED_LOCATION.ZIP,
  };
}

// Helper to get location object (GeoJSON Point)
export function getLocation() {
  return {
    type: 'Point' as const,
    coordinates: [SEED_LOCATION.COORDINATES.longitude, SEED_LOCATION.COORDINATES.latitude],
  };
}

// Helper to get venue address (same as vendor address)
export function getVenueAddress() {
  return getAddress();
}

// Helper to get venue location (same as vendor location)
export function getVenueLocation() {
  return getLocation();
}