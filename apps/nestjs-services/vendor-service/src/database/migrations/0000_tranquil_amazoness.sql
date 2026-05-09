DO $$ BEGIN
 CREATE TYPE "public"."pricing_model" AS ENUM('FREE', 'PER_HOUR', 'CONTRACT', 'MIXED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."time_slot_status" AS ENUM('AVAILABLE', 'BOOKED', 'BLOCKED', 'MAINTENANCE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."vendor_category" AS ENUM('MUSIC', 'ART', 'SPORTS', 'ACTIVITIES', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."venue_type" AS ENUM('INDOOR', 'OUTDOOR', 'STUDIO', 'GALLERY', 'FIELD', 'COURT', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "time_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"status" "time_slot_status" DEFAULT 'AVAILABLE' NOT NULL,
	"recurrence_rule" text,
	"price_override" json,
	"max_bookings" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"business_name" text NOT NULL,
	"description" text,
	"category" "vendor_category" NOT NULL,
	"sub_category" text,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"website" text,
	"address" json NOT NULL,
	"location" json NOT NULL,
	"cover_image" text,
	"verification_status" text DEFAULT 'PENDING' NOT NULL,
	"rating" real DEFAULT 0 NOT NULL,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "venues" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "venue_type" NOT NULL,
	"capacity" integer NOT NULL,
	"address" json NOT NULL,
	"location" json NOT NULL,
	"amenities" text[] DEFAULT '{}' NOT NULL,
	"images" text[] DEFAULT '{}' NOT NULL,
	"pricing_model" "pricing_model" DEFAULT 'PER_HOUR' NOT NULL,
	"hourly_rate" real,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venues" ADD CONSTRAINT "venues_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
