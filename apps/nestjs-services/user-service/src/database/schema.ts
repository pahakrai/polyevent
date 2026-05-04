import crypto from 'crypto';
import {
  pgTable,
  text,
  timestamp,
  json,
  integer,
  boolean,
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
  'LOGOUT',
]);

export const groupMemberRoleEnum = pgEnum('group_member_role', ['ADMIN', 'MEMBER']);

// User profile table (profile information only, no password)
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  role: roleEnum('role').notNull().default('USER'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  interests: text('interests').array().default([]),
  location: json('location'),
  preferences: json('preferences'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

// UserActivity table (for user actions)
export const userActivities = pgTable('user_activities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  eventType: activityTypeEnum('event_type').notNull(),
  metadata: json('metadata').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

// Groups table
export const groups = pgTable('groups', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('owner_id').notNull(),
  maxMembers: integer('max_members'),
  isPrivate: boolean('is_private').notNull().default(false),
  interests: text('interests').array().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

// Group Members table
export const groupMembers = pgTable('group_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: groupMemberRoleEnum('role').notNull().default('MEMBER'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

// Indexes
export const usersEmailIdx = uniqueIndex('users_email_idx').on(users.email);
export const userActivitiesUserIdIdx = index('user_activities_user_id_idx').on(userActivities.userId);
export const groupsOwnerIdIdx = index('groups_owner_id_idx').on(groups.ownerId);
export const groupMembersGroupIdIdx = index('group_members_group_id_idx').on(groupMembers.groupId);

// Export schema
export const schema = {
  users,
  userActivities,
  groups,
  groupMembers,
};

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserActivity = typeof userActivities.$inferSelect;
export type NewUserActivity = typeof userActivities.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;