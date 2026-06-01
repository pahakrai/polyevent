DO $$ BEGIN
 CREATE TYPE "public"."event_type" AS ENUM('FORMAL', 'JAM_SESSION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invitation_type" AS ENUM('CREATOR_INVITE', 'USER_REQUEST');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."vendor_status" AS ENUM('NONE', 'PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "event_status" ADD VALUE 'SOLD_OUT';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"inviter_id" text,
	"type" "invitation_type" NOT NULL,
	"status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "vendor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "vendor_status" "vendor_status" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "vendor_locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "allow_invites" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_type" "event_type" DEFAULT 'FORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "instruments_wanted" text[] DEFAULT  NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "host_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "rsvp_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_invitations" ADD CONSTRAINT "event_invitations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
