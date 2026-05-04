import crypto from 'crypto';
import {
  pgTable,
  text,
  timestamp,
  json,
  integer,
  boolean,
  real,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// Enums
export const vendorCategoryEnum = pgEnum('vendor_category', [
  'MUSIC',
  'ART',
  'SPORTS',
  'ACTIVITIES',
  'OTHER',
]);

export const venueTypeEnum = pgEnum('venue_type', [
  'INDOOR',
  'OUTDOOR',
  'STUDIO',
  'GALLERY',
  'FIELD',
  'COURT',
  'OTHER',
]);

export const pricingModelEnum = pgEnum('pricing_model', [
  'FREE',
  'PER_HOUR',
  'CONTRACT',
  'MIXED',
]);

export const timeSlotStatusEnum = pgEnum('time_slot_status', [
  'AVAILABLE',
  'BOOKED',
  'BLOCKED',
  'MAINTENANCE',
]);

// Vendor table
export const vendors = pgTable('vendors', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique(), // Reference to auth service user ID
  businessName: text('business_name').notNull(),
  description: text('description'),
  category: vendorCategoryEnum('category').notNull(),
  subCategory: text('sub_category'),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone').notNull(),
  website: text('website'),
  address: json('address').notNull(),
  location: json('location').notNull(),
  coverImage: text('cover_image'),
  verificationStatus: text('verification_status').notNull().default('PENDING'),
  rating: real('rating').notNull().default(0),
  totalReviews: integer('total_reviews').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});
// Venue table
export const venues = pgTable('venues', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),
  name: text('name').notNull(),
  description: text('description'),
  type: venueTypeEnum('type').notNull(),
  capacity: integer('capacity').notNull(),
  address: json('address').notNull(),
  location: json('location').notNull(),
  amenities: text('amenities').array().notNull().default([]),
  images: text('images').array().notNull().default([]),
  pricingModel: pricingModelEnum('pricing_model').notNull().default('PER_HOUR'),
  hourlyRate: real('hourly_rate'),
  isAvailable: boolean('is_available').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Time Slot table
export const timeSlots = pgTable('time_slots', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  venueId: text('venue_id').notNull().references(() => venues.id, { onDelete: 'cascade' }),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  status: timeSlotStatusEnum('status').notNull().default('AVAILABLE'),
  recurrenceRule: text('recurrence_rule'),
  priceOverride: json('price_override'),
  maxBookings: integer('max_bookings').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});
// Indexes
export const vendorsUserIdIdx = uniqueIndex('vendors_user_id_idx').on(vendors.userId);
export const venuesVendorIdIdx = index('venues_vendor_id_idx').on(venues.vendorId);
export const timeSlotsVenueIdIdx = index('time_slots_venue_id_idx').on(timeSlots.venueId);

// Export schema
export const schema = {
  vendors,
  venues,
  timeSlots,
};

// Export types
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type Venue = typeof venues.$inferSelect;
export type NewVenue = typeof venues.$inferInsert;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type NewTimeSlot = typeof timeSlots.$inferInsert;