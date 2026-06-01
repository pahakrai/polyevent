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

export const instrumentEnum = pgEnum('instrument', [
  'GUITAR', 'BASS', 'DRUMS', 'PIANO', 'KEYBOARD', 'VOCALS',
  'VIOLIN', 'CELLO', 'SAXOPHONE', 'TRUMPET', 'TROMBONE',
  'FLUTE', 'CLARINET', 'HARMONICA', 'UKULELE', 'SYNTH',
  'DJ', 'PRODUCER', 'OTHER',
]);

export const skillLevelEnum = pgEnum('skill_level', [
  'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL',
]);

export const musicianIntentEnum = pgEnum('musician_intent', [
  'LOOKING_TO_JOIN',
  'LOOKING_FOR_MEMBERS',
  'OPEN_TO_JAM',
  'JUST_BROWSING',
]);

export const groupMemberRoleEnum = pgEnum('group_member_role', ['ADMIN', 'MEMBER']);

export const groupPostTypeEnum = pgEnum('group_post_type', [
  'ANNOUNCEMENT',
  'LOOKING_FOR',
  'DISCUSSION',
  'EVENT',
  'POLL',
]);

// User profile table
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

export const userActivities = pgTable('user_activities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  eventType: activityTypeEnum('event_type').notNull(),
  metadata: json('metadata').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

export const groups = pgTable('groups', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('owner_id').notNull(),
  maxMembers: integer('max_members'),
  isPrivate: boolean('is_private').notNull().default(false),
  interests: text('interests').array().default([]),
  coverImage: text('cover_image'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const groupMembers = pgTable('group_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: groupMemberRoleEnum('role').notNull().default('MEMBER'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const musicianProfiles = pgTable('musician_profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  instruments: instrumentEnum('instruments').array().notNull().default([]),
  skillLevel: skillLevelEnum('skill_level').notNull().default('INTERMEDIATE'),
  genres: text('genres').array().notNull().default([]),
  intent: musicianIntentEnum('intent').notNull().default('JUST_BROWSING'),
  lookingFor: text('looking_for').array().default([]),
  bio: text('bio'),
  influences: text('influences').array().default([]),
  availableDays: text('available_days').array().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const groupMessages = pgTable('group_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text('group_id').notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const groupPosts = pgTable('group_posts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text('group_id').notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  type: groupPostTypeEnum('type').notNull().default('DISCUSSION'),
  title: text('title'),
  content: text('content').notNull(),
  eventId: text('event_id'),
  instrumentsWanted: text('instruments_wanted').array().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

// Indexes
export const usersEmailIdx = uniqueIndex('users_email_idx').on(users.email);
export const userActivitiesUserIdIdx = index('user_activities_user_id_idx').on(userActivities.userId);
export const groupsOwnerIdIdx = index('groups_owner_id_idx').on(groups.ownerId);
export const groupMembersGroupIdIdx = index('group_members_group_id_idx').on(groupMembers.groupId);
export const musicianProfilesUserIdIdx = index('musician_profiles_user_id_idx')
  .on(musicianProfiles.userId);
export const musicianProfilesIntentIdx = index('musician_profiles_intent_idx')
  .on(musicianProfiles.intent);
export const groupMessagesGroupIdCreatedIdx = index('group_messages_group_created_idx')
  .on(groupMessages.groupId, groupMessages.createdAt);
export const groupPostsGroupIdCreatedIdx = index('group_posts_group_created_idx')
  .on(groupPosts.groupId, groupPosts.createdAt);

// Export schema
export const schema = {
  users,
  userActivities,
  groups,
  groupMembers,
  musicianProfiles,
  groupMessages,
  groupPosts,
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserActivity = typeof userActivities.$inferSelect;
export type NewUserActivity = typeof userActivities.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
export type MusicianProfile = typeof musicianProfiles.$inferSelect;
export type NewMusicianProfile = typeof musicianProfiles.$inferInsert;
export type GroupMessage = typeof groupMessages.$inferSelect;
export type NewGroupMessage = typeof groupMessages.$inferInsert;
export type GroupPost = typeof groupPosts.$inferSelect;
export type NewGroupPost = typeof groupPosts.$inferInsert;
