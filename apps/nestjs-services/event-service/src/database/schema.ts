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
  'SOLD_OUT',
]);

export const pricingModelEnum = pgEnum('event_pricing_model', [
  'FREE',
  'PER_HOUR',
  'CONTRACT',
  'MIXED',
]);

export const vendorStatusEnum = pgEnum('vendor_status', [
  'NONE',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'CANCELLED',
]);

export const invitationTypeEnum = pgEnum('invitation_type', [
  'CREATOR_INVITE',
  'USER_REQUEST',
]);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
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
  // Vendor booking lifecycle
  vendorStatus: vendorStatusEnum('vendor_status').notNull().default('NONE'),
  vendorLockedAt: timestamp('vendor_locked_at'),
  // Invite / quota control
  allowInvites: boolean('allow_invites').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

// Event invitations — both creator-invited and user-requested
export const eventInvitations = pgTable('event_invitations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  inviterId: text('inviter_id'), // The user who sent the invite (null for USER_REQUEST)
  type: invitationTypeEnum('type').notNull(),
  status: invitationStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

// Indexes
export const eventInvitationsEventIdIdx = uniqueIndex('event_invitations_event_user_idx')
  .on(eventInvitations.eventId, eventInvitations.userId);

// Export schema
export const schema = {
  events,
  eventInvitations,
};

// Export types
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventInvitation = typeof eventInvitations.$inferSelect;
export type NewEventInvitation = typeof eventInvitations.$inferInsert;
