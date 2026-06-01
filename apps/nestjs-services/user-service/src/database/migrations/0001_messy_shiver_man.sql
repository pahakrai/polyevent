DO $$ BEGIN
 CREATE TYPE "public"."instrument" AS ENUM('GUITAR', 'BASS', 'DRUMS', 'PIANO', 'KEYBOARD', 'VOCALS', 'VIOLIN', 'CELLO', 'SAXOPHONE', 'TRUMPET', 'TROMBONE', 'FLUTE', 'CLARINET', 'HARMONICA', 'UKULELE', 'SYNTH', 'DJ', 'PRODUCER', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."musician_intent" AS ENUM('LOOKING_TO_JOIN', 'LOOKING_FOR_MEMBERS', 'OPEN_TO_JAM', 'JUST_BROWSING');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."skill_level" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "musician_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"instruments" instrument[] DEFAULT  NOT NULL,
	"skill_level" "skill_level" DEFAULT 'INTERMEDIATE' NOT NULL,
	"genres" text[] DEFAULT  NOT NULL,
	"intent" "musician_intent" DEFAULT 'JUST_BROWSING' NOT NULL,
	"looking_for" text[] DEFAULT ,
	"bio" text,
	"influences" text[] DEFAULT ,
	"available_days" text[] DEFAULT ,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "musician_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "musician_profiles" ADD CONSTRAINT "musician_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
