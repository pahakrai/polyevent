import {
  pgTable,
  text,
  timestamp,
  json,
  integer,
  boolean,
  pgEnum,
  uniqueIndex
} from 'drizzle-orm/pg-core';

// Enums
export const eventCategoryEnum = pgEnum('event_category', [
  'CONCERT',
  'WORKSHOP',
  'JAM_SESSION',
  'OPEN_MIC',
  'FESTIVAL',
  'PRIVATE_PARTY',
  'CORPORATE_EVENT',
  'CLASS',
  'OTHER'
]);

export const eventStatusEnum = pgEnum('event_status', [
  'DRAFT',
  'PUBLISHED',
  'CANCELLED',
  'COMPLETED',
  'POSTPONED'
]);

// Event table
export const events = pgTable('events', {
  id: text('id').primaryKey().$defaultFn(() => 'gen_random_uuid()'),
  vendorId: text('vendor_id').notNull(), // Reference to vendor service vendor ID
  venueId: text('venue_id'), // Reference to vendor service venue ID
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: eventCategoryEnum('category').notNull(),
  subCategory: text('sub_category'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  location: json('location').notNull(),
  price: json('price').notNull(),
  maxAttendees: integer('max_attendees'),
  currentBookings: integer('current_bookings').notNull().default(0),
  status: eventStatusEnum('status').notNull().default('DRAFT'),
  tags: text('tags').array().notNull().default([]),
  images: text('images').array().notNull().default([]),
  ageRestriction: integer('age_restriction'),
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurringRule: text('recurring_rule'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
});

// Indexes
export const eventsVendorIdIdx = uniqueIndex('events_vendor_id_idx').on(events.vendorId);
export const eventsVenueIdIdx = uniqueIndex('events_venue_id_idx').on(events.venueId);

// Export schema
export const schema = {
  events,
};

// Export types
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;