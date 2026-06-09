import crypto from 'crypto';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  json,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  adminId: text('admin_id').notNull(),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  details: json('details').default({}),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const featureFlags = pgTable('feature_flags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(false),
  conditions: json('conditions').default({}),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const systemConfig = pgTable('system_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  value: json('value').notNull(),
  description: text('description'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Indexes
export const auditAdminIdIdx = index('audit_admin_id_idx').on(adminAuditLogs.adminId);
export const auditActionIdx = index('audit_action_idx').on(adminAuditLogs.action);
export const flagsKeyIdx = uniqueIndex('flags_key_idx').on(featureFlags.key);
export const configKeyIdx = uniqueIndex('config_key_idx').on(systemConfig.key);

export const schema = { adminAuditLogs, featureFlags, systemConfig };

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
export type SystemConfigItem = typeof systemConfig.$inferSelect;
export type NewSystemConfigItem = typeof systemConfig.$inferInsert;
