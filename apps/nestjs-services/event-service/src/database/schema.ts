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

export const eventCategoryEnum = pgEnum('event_category', [
  'MUSIC',
  'ART',
  'SPORTS',
  'ACTIVITIES',
  'OTHER',
]);

export const eventTypeEnum = pgEnum('event_type', [
  'FORMAL',
  'JAM_SESSION',
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

export const events = pgTable('events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text('vendor_id'),
  venueId: text('venue_id'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: eventCategoryEnum('category').notNull(),
  subCategory: text('sub_category'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  location: json('location').notNull(),
  price: json('price'),
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
  vendorStatus: vendorStatusEnum('vendor_status').notNull().default('NONE'),
  vendorLockedAt: timestamp('vendor_locked_at'),
  allowInvites: boolean('allow_invites').notNull().default(true),
  eventType: eventTypeEnum('event_type').notNull().default('FORMAL'),
  instrumentsWanted: text('instruments_wanted').array().notNull().default([]),
  hostId: text('host_id'),
  rsvpCount: integer('rsvp_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const eventInvitations = pgTable('event_invitations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  inviterId: text('inviter_id'),
  type: invitationTypeEnum('type').notNull(),
  status: invitationStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const eventInvitationsEventIdIdx = uniqueIndex('event_invitations_event_user_idx')
  .on(eventInvitations.eventId, eventInvitations.userId);
export const eventsEventTypeIdx = index('events_event_type_idx').on(events.eventType);
export const eventsHostIdIdx = index('events_host_id_idx').on(events.hostId);

export const schema = {
  events,
  eventInvitations,
};

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventInvitation = typeof eventInvitations.$inferSelect;
export type NewEventInvitation = typeof eventInvitations.$inferInsert;
