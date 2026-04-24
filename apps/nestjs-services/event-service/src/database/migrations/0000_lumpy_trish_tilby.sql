DO $$ BEGIN
 CREATE TYPE "public"."event_category" AS ENUM('CONCERT', 'WORKSHOP', 'JAM_SESSION', 'OPEN_MIC', 'FESTIVAL', 'PRIVATE_PARTY', 'CORPORATE_EVENT', 'CLASS', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_status" AS ENUM('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'POSTPONED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"venue_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" "event_category" NOT NULL,
	"sub_category" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"location" json NOT NULL,
	"price" json NOT NULL,
	"max_attendees" integer,
	"current_bookings" integer DEFAULT 0 NOT NULL,
	"status" "event_status" DEFAULT 'DRAFT' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"images" text[] DEFAULT '{}' NOT NULL,
	"age_restriction" integer,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurring_rule" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
