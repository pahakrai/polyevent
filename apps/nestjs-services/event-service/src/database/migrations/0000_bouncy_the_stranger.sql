DO $$ BEGIN
 CREATE TYPE "public"."event_category" AS ENUM('MUSIC', 'ART', 'SPORTS', 'ACTIVITIES', 'OTHER');
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
DO $$ BEGIN
 CREATE TYPE "public"."event_pricing_model" AS ENUM('FREE', 'PER_HOUR', 'CONTRACT', 'MIXED');
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
	"pricing_model" "event_pricing_model" DEFAULT 'FREE' NOT NULL,
	"max_attendees" integer,
	"current_bookings" integer DEFAULT 0 NOT NULL,
	"status" "event_status" DEFAULT 'DRAFT' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"images" text[] DEFAULT '{}' NOT NULL,
	"age_restriction" integer,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurring_rule" text,
	"time_slot_id" text,
	"group_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
