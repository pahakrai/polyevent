import {
  pgTable,
  text,
  timestamp,
  json,
  integer,
  boolean,
  real,
  pgEnum,
  uniqueIndex
} from 'drizzle-orm/pg-core';

// Enums
export const vendorCategoryEnum = pgEnum('vendor_category', [
  'MUSIC_VENUE',
  'EVENT_PLANNER',
  'CATERING',
  'PHOTOGRAPHY',
  'SECURITY',
  'EQUIPMENT_RENTAL',
  'OTHER'
]);

export const venueTypeEnum = pgEnum('venue_type', [
  'BAR',
  'CLUB',
  'THEATER',
  'CONCERT_HALL',
  'STUDIO',
  'OUTDOOR',
  'COMMUNITY_CENTER',
  'PRIVATE_RESIDENCE'
]);

// Vendor table
export const vendors = pgTable('vendors', {
  id: text('id').primaryKey().$defaultFn(() => 'gen_random_uuid()'),
  userId: text('user_id').notNull().unique(), // Reference to auth service user ID
  businessName: text('business_name').notNull(),
  description: text('description'),
  category: vendorCategoryEnum('category').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone').notNull(),
  website: text('website'),
  address: json('address').notNull(),
  location: json('location').notNull(),
  verificationStatus: text('verification_status').notNull().default('PENDING'),
  rating: real('rating').notNull().default(0),
  totalReviews: integer('total_reviews').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
});

// Venue table
export const venues = pgTable('venues', {
  id: text('id').primaryKey().$defaultFn(() => 'gen_random_uuid()'),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),
  name: text('name').notNull(),
  description: text('description'),
  type: venueTypeEnum('type').notNull(),
  capacity: integer('capacity').notNull(),
  address: json('address').notNull(),
  location: json('location').notNull(),
  amenities: text('amenities').array().notNull().default([]),
  images: text('images').array().notNull().default([]),
  hourlyRate: real('hourly_rate'),
  isAvailable: boolean('is_available').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Indexes
export const vendorsUserIdIdx = uniqueIndex('vendors_user_id_idx').on(vendors.userId);
export const venuesVendorIdIdx = uniqueIndex('venues_vendor_id_idx').on(venues.vendorId);

// Export schema
export const schema = {
  vendors,
  venues,
};

// Export types
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type Venue = typeof venues.$inferSelect;
export type NewVenue = typeof venues.$inferInsert;