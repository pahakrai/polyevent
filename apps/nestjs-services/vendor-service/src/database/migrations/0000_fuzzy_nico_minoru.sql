DO $$ BEGIN
 CREATE TYPE "public"."vendor_category" AS ENUM('MUSIC_VENUE', 'EVENT_PLANNER', 'CATERING', 'PHOTOGRAPHY', 'SECURITY', 'EQUIPMENT_RENTAL', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."venue_type" AS ENUM('BAR', 'CLUB', 'THEATER', 'CONCERT_HALL', 'STUDIO', 'OUTDOOR', 'COMMUNITY_CENTER', 'PRIVATE_RESIDENCE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"business_name" text NOT NULL,
	"description" text,
	"category" "vendor_category" NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"website" text,
	"address" json NOT NULL,
	"location" json NOT NULL,
	"verification_status" text DEFAULT 'PENDING' NOT NULL,
	"rating" real DEFAULT 0 NOT NULL,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
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
	"hourly_rate" real,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venues" ADD CONSTRAINT "venues_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
