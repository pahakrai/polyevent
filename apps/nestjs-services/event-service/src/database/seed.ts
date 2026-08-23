import { db } from './client';
import { eventTypes } from './schema';

/**
 * Seed the configurable event types across categories. Idempotent — runs
 * safely on every invocation via `ON CONFLICT (slug) DO NOTHING`.
 */
const PRESET_EVENT_TYPES = [
  { id: 'evt_general', slug: 'general', name: 'General Event', category: 'OTHER', allowRsvp: false },
  { id: 'evt_concert', slug: 'concert', name: 'Concert', category: 'MUSIC', allowRsvp: false },
  { id: 'evt_jam_session', slug: 'jam_session', name: 'Jam Session', category: 'MUSIC', allowRsvp: true, attributesSchema: { type: 'object', properties: { instrumentsWanted: { type: 'array', items: { type: 'string' } } } } },
  { id: 'evt_open_mic', slug: 'open_mic', name: 'Open Mic', category: 'MUSIC', allowRsvp: true },
  { id: 'evt_festival', slug: 'festival', name: 'Festival', category: 'MUSIC', allowRsvp: false },
  { id: 'evt_private_lesson', slug: 'private_lesson', name: 'Private Lesson', category: 'MUSIC', allowRsvp: false },
  { id: 'evt_art_class', slug: 'art_class', name: 'Art Class', category: 'ART', allowRsvp: true, attributesSchema: { type: 'object', properties: { materials: { type: 'array', items: { type: 'string' } } } } },
  { id: 'evt_gallery_opening', slug: 'gallery_opening', name: 'Gallery Opening', category: 'ART', allowRsvp: false },
  { id: 'evt_pickup_game', slug: 'pickup_game', name: 'Pickup Game', category: 'SPORTS', allowRsvp: true, attributesSchema: { type: 'object', properties: { sport: { type: 'string' }, skillLevel: { type: 'string' }, teamSize: { type: 'number' } } } },
  { id: 'evt_tournament', slug: 'tournament', name: 'Tournament', category: 'SPORTS', allowRsvp: false },
  { id: 'evt_fitness_class', slug: 'fitness_class', name: 'Fitness Class', category: 'SPORTS', allowRsvp: true },
  { id: 'evt_workshop', slug: 'workshop', name: 'Workshop', category: 'ACTIVITIES', allowRsvp: false },
  { id: 'evt_hiking_trip', slug: 'hiking_trip', name: 'Hiking Trip', category: 'ACTIVITIES', allowRsvp: true },
  { id: 'evt_board_game_night', slug: 'board_game_night', name: 'Board Game Night', category: 'ACTIVITIES', allowRsvp: true },
] as const;

async function seed(): Promise<void> {
  await db
    .insert(eventTypes)
    .values(PRESET_EVENT_TYPES.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      category: t.category as any,
      allowRsvp: t.allowRsvp,
      attributesSchema: (t as any).attributesSchema ?? {},
    })))
    .onConflictDoNothing({ target: eventTypes.slug });

  console.log(`event-service: seeded ${PRESET_EVENT_TYPES.length} event types`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('event-service seed failed:', err);
    process.exit(1);
  });
