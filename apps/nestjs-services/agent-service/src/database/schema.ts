import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * Persisted investigation sessions.
 * In-memory Map is used in development; this table supports production deployment.
 */
export const investigationSessions = pgTable('investigation_sessions', {
  id: text('id').primaryKey(),
  vendorId: text('vendor_id').notNull(),
  goal: text('goal').notNull(),
  status: text('status').notNull().default('in_progress'),
  steps: jsonb('steps').notNull().default([]),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
});

export const schema = {
  investigationSessions,
};
