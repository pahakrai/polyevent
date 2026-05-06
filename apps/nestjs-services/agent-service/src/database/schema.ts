import { pgTable, text, timestamp, jsonb, customType } from 'drizzle-orm/pg-core';

/**
 * Custom pgvector column type (384-dimensional embeddings from all-MiniLM-L6-v2).
 * Stored as native PostgreSQL vector(384); serialized as number[] in JS.
 */
const vector384 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(384)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    // pgvector returns '[0.1,0.2,...]' format
    return value.slice(1, -1).split(',').map(Number);
  },
});

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
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

/**
 * RAG documents table with pgvector embeddings.
 *
 * NOTE: drizzle-kit quotes the vector(384) type in generated migrations.
 * After generation, manually remove the double-quotes around "vector(384)".
 * Runtime (Drizzle ORM) does not use dataType() from customType — the raw SQL
 * queries in KnowledgeService handle vector serialization directly.
 */
export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  contentType: text('content_type').notNull().default('text/plain'),
  chunks: jsonb('chunks').notNull().default([]),
  embedding: vector384('embedding').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const schema = {
  investigationSessions,
  documents,
};
