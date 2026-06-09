import crypto from 'crypto';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  json,
  pgEnum,
  uniqueIndex,
  index,
  time,
} from 'drizzle-orm/pg-core';

export const channelEnum = pgEnum('channel', ['EMAIL', 'SMS', 'PUSH', 'IN_APP']);
export const statusEnum = pgEnum('notification_status', ['PENDING', 'SENT', 'FAILED', 'READ']);

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  channel: channelEnum('channel').notNull(),
  templateId: text('template_id'),
  subject: text('subject'),
  content: json('content').notNull(),
  status: statusEnum('status').notNull().default('PENDING'),
  metadata: json('metadata').default({}),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const notificationTemplates = pgTable('notification_templates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  channel: channelEnum('channel').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  variables: json('variables').$type<string[]>().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique(),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  smsEnabled: boolean('sms_enabled').notNull().default(false),
  pushEnabled: boolean('push_enabled').notNull().default(true),
  inAppEnabled: boolean('in_app_enabled').notNull().default(true),
  marketingEmails: boolean('marketing_emails').notNull().default(false),
  quietHoursStart: time('quiet_hours_start'),
  quietHoursEnd: time('quiet_hours_end'),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

// Indexes
export const notificationsUserIdIdx = index('notifications_user_id_idx').on(notifications.userId);
export const notificationsStatusIdx = index('notifications_status_idx').on(notifications.status);
export const templatesNameIdx = uniqueIndex('templates_name_idx').on(notificationTemplates.name);
export const preferencesUserIdIdx = uniqueIndex('preferences_user_id_idx').on(notificationPreferences.userId);

export const schema = {
  notifications,
  notificationTemplates,
  notificationPreferences,
};

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
