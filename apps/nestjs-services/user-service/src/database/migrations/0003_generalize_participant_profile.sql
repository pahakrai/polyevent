-- 0003_generalize_participant_profile
-- ---------------------------------------------------------------------------
-- Generalizes the musician-specific profile so the platform serves arbitrary
-- event types (art, sports, activities, ...), not just music:
--   * `instruments` becomes a free-form text[] of skills/tags (drops the
--     hardcoded instrument enum).
--   * `musician_intent` becomes `participant_intent` and the music-specific
--     value OPEN_TO_JAM becomes OPEN_TO_PARTICIPATE.
-- ---------------------------------------------------------------------------

CREATE TYPE "public"."participant_intent" AS ENUM('LOOKING_TO_JOIN', 'LOOKING_FOR_MEMBERS', 'OPEN_TO_PARTICIPATE', 'JUST_BROWSING');--> statement-breakpoint

UPDATE "musician_profiles" SET "intent" = 'OPEN_TO_PARTICIPATE' WHERE "intent" = 'OPEN_TO_JAM';--> statement-breakpoint

ALTER TABLE "musician_profiles" ALTER COLUMN "intent" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "musician_profiles" ALTER COLUMN "intent" TYPE "participant_intent" USING ("intent"::text::"participant_intent");--> statement-breakpoint
ALTER TABLE "musician_profiles" ALTER COLUMN "intent" SET DEFAULT 'JUST_BROWSING';--> statement-breakpoint

ALTER TABLE "musician_profiles" ALTER COLUMN "instruments" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "musician_profiles" ALTER COLUMN "instruments" TYPE text[] USING ("instruments"::text[]);--> statement-breakpoint
ALTER TABLE "musician_profiles" ALTER COLUMN "instruments" SET DEFAULT '{}';--> statement-breakpoint

DROP TYPE "public"."musician_intent";--> statement-breakpoint
DROP TYPE "public"."instrument";
