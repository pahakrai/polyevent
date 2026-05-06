CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_type" text DEFAULT 'text/plain' NOT NULL,
	"chunks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embedding" vector(384) NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investigation_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"goal" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
