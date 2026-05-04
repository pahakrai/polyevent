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
} from 'drizzle-orm/pg-core';

// Top-level category enum
export const eventCategoryEnum = pgEnum('event_category', [
  'MUSIC',
  'ART',
  'SPORTS',
  'ACTIVITIES',
  'OTHER',
]);

export const eventStatusEnum = pgEnum('event_status', [
  'DRAFT',
  'PUBLISHED',
  'CANCELLED',
  'COMPLETED',
  'POSTPONED',
]);

export const pricingModelEnum = pgEnum('event_pricing_model', [
  'FREE',
  'PER_HOUR',
  'CONTRACT',
  'MIXED',
]);

// Event table
export const events = pgTable('events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  pricingModel: pricingModelEnum('pricing_model').notNull().default('FREE'),
  maxAttendees: integer('max_attendees'),
  currentBookings: integer('current_bookings').notNull().default(0),
  status: eventStatusEnum('status').notNull().default('DRAFT'),
  tags: text('tags').array().notNull().default([]),
  images: text('images').array().notNull().default([]),
  ageRestriction: integer('age_restriction'),
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurringRule: text('recurring_rule'),
  timeSlotId: text('time_slot_id'),
  groupId: text('group_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

// Export schema
export const schema = {
  events,
};

// Export types
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;