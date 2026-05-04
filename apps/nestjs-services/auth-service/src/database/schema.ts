import crypto from 'crypto';
import {
  pgTable,
  text,
  timestamp,
  json,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// Enums
export const roleEnum = pgEnum('role', ['USER', 'VENDOR', 'ADMIN']);
export const activityTypeEnum = pgEnum('activity_type', [
  'SEARCH',
  'VIEW_EVENT',
  'BOOKING_CREATED',
  'BOOKING_CANCELLED',
  'REVIEW_CREATED',
  'LOGIN',
  'LOGOUT'
]);

// User table (for authentication)
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  role: roleEnum('role').notNull().default('USER'),
  location: json('location'),
  preferences: json('preferences'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

// UserActivity table (for login/logout tracking)
export const userActivities = pgTable('user_activities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  eventType: activityTypeEnum('event_type').notNull(),
  metadata: json('metadata').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

// Indexes
export const usersEmailIdx = uniqueIndex('users_email_idx').on(users.email);
export const userActivitiesUserIdIdx = index('user_activities_user_id_idx').on(userActivities.userId);

// Export schema
export const schema = {
  users,
  userActivities,
};

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserActivity = typeof userActivities.$inferSelect;
export type NewUserActivity = typeof userActivities.$inferInsert;