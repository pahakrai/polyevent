-- 0002_dynamic_event_types
-- ---------------------------------------------------------------------------
-- Introduces configurable event types and generalizes events from the
-- music-only `event_type` enum to a reference + type-specific `attributes`.
-- ---------------------------------------------------------------------------

CREATE TABLE "event_types" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" "event_category" NOT NULL,
	"icon" text,
	"attributes_schema" jsonb DEFAULT '{}',
	"allow_rsvp" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_types_slug_unique" UNIQUE("slug")
);--> statement-breakpoint

-- Preset event types across categories.
INSERT INTO "event_types" ("id","slug","name","category","allow_rsvp","attributes_schema") VALUES
  ('evt_general','general','General Event','OTHER',false,'{}'),
  ('evt_concert','concert','Concert','MUSIC',false,'{}'),
  ('evt_jam_session','jam_session','Jam Session','MUSIC',true,'{"type":"object","properties":{"instrumentsWanted":{"type":"array","items":{"type":"string"}}}}'),
  ('evt_open_mic','open_mic','Open Mic','MUSIC',true,'{}'),
  ('evt_festival','festival','Festival','MUSIC',false,'{}'),
  ('evt_private_lesson','private_lesson','Private Lesson','MUSIC',false,'{}'),
  ('evt_art_class','art_class','Art Class','ART',true,'{"type":"object","properties":{"materials":{"type":"array","items":{"type":"string"}}}}'),
  ('evt_gallery_opening','gallery_opening','Gallery Opening','ART',false,'{}'),
  ('evt_pickup_game','pickup_game','Pickup Game','SPORTS',true,'{"type":"object","properties":{"sport":{"type":"string"},"skillLevel":{"type":"string"},"teamSize":{"type":"number"}}}'),
  ('evt_tournament','tournament','Tournament','SPORTS',false,'{}'),
  ('evt_fitness_class','fitness_class','Fitness Class','SPORTS',true,'{}'),
  ('evt_workshop','workshop','Workshop','ACTIVITIES',false,'{}'),
  ('evt_hiking_trip','hiking_trip','Hiking Trip','ACTIVITIES',true,'{}'),
  ('evt_board_game_night','board_game_night','Board Game Night','ACTIVITIES',true,'{}')
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

-- Add new columns.
ALTER TABLE "events" ADD COLUMN "event_type_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "attributes" jsonb DEFAULT '{}';--> statement-breakpoint

-- Backfill: map legacy event_type to a configurable type, and fold
-- instruments_wanted into the attributes payload.
UPDATE "events" SET "event_type_id" = (
  SELECT "id" FROM "event_types"
  WHERE "slug" = CASE WHEN "events"."event_type" = 'JAM_SESSION' THEN 'jam_session' ELSE 'general' END
) WHERE "event_type_id" IS NULL;--> statement-breakpoint

UPDATE "events" SET "attributes" = jsonb_build_object('instrumentsWanted', "instruments_wanted")
WHERE "instruments_wanted" IS NOT NULL AND array_length("instruments_wanted", 1) > 0;--> statement-breakpoint

-- Drop the music-specific columns and enum.
ALTER TABLE "events" DROP COLUMN "event_type";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "instruments_wanted";--> statement-breakpoint
DROP TYPE "event_type";--> statement-breakpoint

ALTER TABLE "events" ADD CONSTRAINT "events_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_event_type_id_idx" ON "events" USING btree ("event_type_id");
