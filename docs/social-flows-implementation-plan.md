# Social Flows Implementation Plan
## Bringing Casual Interests Together — Polydom v2

**Date**: 2026-06-01
**Status**: Draft

---

## Overview

Three self-contained flows, ordered by impact. Each can ship independently.
Estimated effort: ~3–4 weeks for all three with one full-stack developer.

| # | Flow | Services touched | New tables | New endpoints | New frontend pages |
|---|------|-----------------|------------|---------------|-------------------|
| 1 | Musician Profile & Discovery | user-service, search-service | 1 | 4 | 3 |
| 2 | Jam Session Proposals | event-service | 0 (reuse events) | 5 | 3 |
| 3 | Group Hub Enhancement | user-service, event-service, agent-service | 2 | 8 | 4 |

---

## Flow 1: Musician Profile & Discovery

### What it does
Users select instruments, skill level, genres, and intent ("looking to join" / "looking for members"). This feeds a personalized discovery feed and a "Musicians Near You" browse page. The platform shifts from "find events" to "find people."

### 1a. Database — `user-service`

**New table: `musician_profiles`**

```sql
-- Add to user-service/src/database/schema.ts

export const instrumentEnum = pgEnum('instrument', [
  'GUITAR', 'BASS', 'DRUMS', 'PIANO', 'KEYBOARD', 'VOCALS',
  'VIOLIN', 'CELLO', 'SAXOPHONE', 'TRUMPET', 'TROMBONE',
  'FLUTE', 'CLARINET', 'HARMONICA', 'UKULELE', 'SYNTH',
  'DJ', 'PRODUCER', 'OTHER',
]);

export const skillLevelEnum = pgEnum('skill_level', [
  'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL',
]);

export const musicianIntentEnum = pgEnum('musician_intent', [
  'LOOKING_TO_JOIN',
  'LOOKING_FOR_MEMBERS',
  'OPEN_TO_JAM',
  'JUST_BROWSING',
]);

export const musicianProfiles = pgTable('musician_profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  instruments: instrumentEnum('instruments').array().notNull().default([]),
  skillLevel: skillLevelEnum('skill_level').notNull().default('INTERMEDIATE'),
  genres: text('genres').array().notNull().default([]),
  intent: musicianIntentEnum('intent').notNull().default('JUST_BROWSING'),
  lookingFor: text('looking_for').array().default([]),
  bio: text('bio'),
  influences: text('influences').array().default([]),
  availableDays: text('available_days').array().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull()
    .defaultNow().$onUpdateFn(() => new Date()),
});
```

**Column additions to existing `users` table:** Extend `UpdateProfileDto`:

```typescript
// In user-service/src/user/dto/update-profile.dto.ts
@IsObject()
@IsOptional()
musicianProfile?: {
  instruments?: string[];
  skillLevel?: string;
  genres?: string[];
  intent?: string;
  lookingFor?: string[];
  bio?: string;
  influences?: string[];
  availableDays?: string[];
};
```

### 1b. API — `user-service`

**New endpoints on `UserController`:**

```
GET  /users/musicians               Browse musicians
     ?instruments=GUITAR,BASS
     &genres=JAZZ,BLUES
     &skill=INTERMEDIATE
     &intent=LOOKING_TO_JOIN
     &lat=40.7&lon=-74.0&radiusKm=20
     &page=1&limit=20

GET  /users/:id/musician-profile    Get a user's musician profile

PUT  /users/profile/musician        Upsert musician profile
     Body: { instruments, skillLevel, genres, intent, lookingFor, ... }

GET  /users/discover/for-you        Personalized discovery feed
     Uses user's lookingFor + genres + location
     Returns { musicians, jamSessions, suggestedGroups }
```

**`GET /users/discover/for-you` logic:**
- Reads current user's `musicianProfiles.lookingFor` and `genres`
- Finds musicians whose `instruments` overlap with `lookingFor` AND whose `genres` overlap
- Sorted by geographic proximity (uses `users.location` JSON field)
- Merges with jam sessions (Flow 2) and suggested groups (Flow 3)
- Returns unified, ranked feed

### 1c. Frontend — new pages & components

**New pages:**

| Route | Page | Description |
|-------|------|-------------|
| `/musicians` | `MusicianBrowsePage` | Browse/filter musicians by instrument, genre, skill, location |
| `/musicians/[userId]` | `MusicianProfilePage` | Public profile: instruments, genres, influences, intent badge |
| `/discover` | `DiscoverPage` | Personalized "For You" feed — musicians + jams + groups |

**New components:**

| Component | Purpose |
|-----------|---------|
| `MusicianCard` | Card: name, instrument badges, skill level, genres, distance, intent badge |
| `MusicianProfileForm` | Onboarding form: instrument multi-select, skill dropdown, genre tags |
| `IntentBadge` | Visual badge: green="Looking to join", blue="Looking for members", amber="Open to jam" |
| `DiscoveryFeed` | Combined feed of musicians + jam sessions + groups, ranked by relevance |

**Onboarding integration:**
After signup, 2-step wizard:
1. "What do you play?" — instrument multi-select (guitar, drums, vocals, ...)
2. "What are you looking for?" — intent selector + genre tags

Calls `PUT /users/profile/musician`, then redirects to `/discover`.

### 1d. Agent service extension

New tool in `tools.ts`: `search_musicians`
- Queries `musician_profiles` + `users` (location join)
- Parameters: `{ instruments?, genres?, skillLevel?, intent?, lat?, lon?, radiusKm? }`
- Returns ranked results with distance, skill, genre overlap

New skill: "When investigating musician availability or talent pool, use search_musicians to find matching profiles. Consider skill level, proximity, and genre compatibility."

### 1e. Elasticsearch indexing

Index `musician_profiles` for fast faceted search:
- Fields: `userId`, `instruments`, `skillLevel`, `genres`, `intent`, `location` (geo_point)
- Re-index on `user.updated` NATS event (extend existing NATS publisher)

---

## Flow 2: Jam Session Proposals

### What it does
Any authenticated user can propose a casual jam session — no vendor, no payment, no tickets. "Looking for 2–3 musicians to jam this Sunday at Central Park." Other users RSVP "I'm in."

### 2a. Database — `event-service`

**No new table.** Add columns to existing `events` table:

```sql
ALTER TABLE events ADD COLUMN event_type VARCHAR(20) NOT NULL DEFAULT 'FORMAL';
-- Values: 'FORMAL' (existing vendor events), 'JAM_SESSION'

ALTER TABLE events ADD COLUMN instruments_wanted TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE events ADD COLUMN instruments_brought TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE events ADD COLUMN host_id TEXT;     -- User who proposed it
ALTER TABLE events ADD COLUMN rsvp_count INTEGER NOT NULL DEFAULT 0;

-- Make vendorId nullable for JAM_SESSION type
ALTER TABLE events ALTER COLUMN vendor_id DROP NOT NULL;
-- Add CHECK: vendor_id IS NOT NULL WHEN event_type = 'FORMAL'
ALTER TABLE events ADD CONSTRAINT ck_formal_has_vendor
  CHECK (event_type != 'FORMAL' OR vendor_id IS NOT NULL);
```

**Why reuse `events`:** Jam sessions share 80% of the schema (title, description, location, time, tags, maxAttendees). A type discriminator + 4 columns is cleaner than a parallel table.

### 2b. DTO changes — `event-service`

**Extend `CreateEventDto`:**
```typescript
@IsString()
@IsOptional()
eventType?: string; // 'FORMAL' (default) | 'JAM_SESSION'

@IsArray()
@IsString({ each: true })
@IsOptional()
instrumentsWanted?: string[];

@IsString()
@IsOptional()
hostId?: string;
```

**New DTO: `CreateJamSessionDto`** (lightweight, no vendor fields):
```typescript
export class CreateJamSessionDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) description: string;
  @IsDateString() startTime: string;
  @IsDateString() endTime: string;
  @IsObject() location: { ... };
  @IsArray() @IsString({ each: true }) instrumentsWanted: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() genres?: string[];
  @IsInt() @Min(2) @IsOptional() maxParticipants?: number;
}
```

### 2c. API — `event-service`

**New endpoints:**

```
POST   /events/jam-sessions          Create jam session (hostId from x-user-id header)
GET    /events/jam-sessions          Browse jam sessions
       ?instrumentsWanted=GUITAR,DRUMS
       &genres=ROCK,JAZZ
       &lat=40.7&lon=-74.0&radiusKm=20
       &page=1&limit=20

POST   /events/:id/rsvp              RSVP "I'm in" (userId from x-user-id)
DELETE /events/:id/rsvp              Cancel RSVP
GET    /events/:id/attendees         List attendees with instrument badges
```

**RSVP flow:**
1. `POST /events/:id/rsvp` → increments `rsvp_count`, inserts into `event_invitations` with type=`USER_REQUEST` and status=`ACCEPTED`
2. Publishes `jam.rsvp.created` to NATS
3. If `rsvp_count >= maxAttendees`, auto-mark as `SOLD_OUT`
4. Host receives notification on each RSVP

### 2d. Frontend — new pages & components

**New pages:**

| Route | Page | Description |
|-------|------|-------------|
| `/jams` | `JamBrowsePage` | Browse jam sessions with instrument/genre/location filters |
| `/jams/new` | `CreateJamPage` | Simple form: title, description, location, time, instruments wanted |
| `/jams/[id]` | `JamDetailPage` | Details, attendee list with instrument badges, RSVP button |

**New components:**

| Component | Purpose |
|-----------|---------|
| `JamCard` | Card: title, host name, instruments wanted (badges), time, distance, RSVP count |
| `CreateJamForm` | Form: instrument multi-select, date/time picker, location, description |
| `AttendeeList` | Grid of attendee avatars with instrument badges underneath |
| `RsvpButton` | "I'm In" button — animated count, optimistic update via TanStack Query |

### 2e. Integration with Flow 1

Jam sessions appear in `GET /users/discover/for-you`:
- If user's `instruments` ⊆ jam's `instrumentsWanted`, boost ranking
- If user's `genres` overlap with jam's tags, boost ranking

### 2f. NATS events

```
jam.created        → notification-service (alert matching musicians)
jam.rsvp.created   → notification-service (alert host)
jam.rsvp.cancelled → notification-service
jam.full           → notification-service (alert host, mark SOLD_OUT)
```

---

## Flow 3: Group Hub Enhancement

### What it does
Groups become active community hubs: posts (announcements, "looking for"), group-scoped jam sessions, real-time chat, and group discovery fed by user interests.

### 3a. Database — `user-service`

**New table: `group_messages`** (chat)

```sql
export const groupMessages = pgTable('group_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text('group_id').notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

-- Index for cursor-based pagination
export const groupMessagesGroupIdCreatedIdx = index('group_messages_group_created_idx')
  .on(groupMessages.groupId, groupMessages.createdAt);
```

**New table: `group_posts`** (community board)

```sql
export const groupPostTypeEnum = pgEnum('group_post_type', [
  'ANNOUNCEMENT',
  'LOOKING_FOR',
  'DISCUSSION',
  'EVENT',
  'POLL',
]);

export const groupPosts = pgTable('group_posts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text('group_id').notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  type: groupPostTypeEnum('type').notNull().default('DISCUSSION'),
  title: text('title'),
  content: text('content').notNull(),
  eventId: text('event_id'),
  instrumentsWanted: text('instruments_wanted').array().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull()
    .defaultNow().$onUpdateFn(() => new Date()),
});
```

### 3b. API — `user-service` (extend `GroupController`)

```
POST   /groups/:id/posts             Create a post
GET    /groups/:id/posts             List posts (paginated)
POST   /groups/:id/messages          Send a chat message
GET    /groups/:id/messages          List messages (cursor: ?after=<messageId>)
POST   /groups/:id/jams              Create group-scoped jam (proxies to event-service)
GET    /groups/:id/jams              List group jam sessions
POST   /groups/:id/invite-link       Generate invite link
POST   /groups/join/:inviteCode      Join via invite link
GET    /groups/discover              "Suggested groups" based on user interests + location
```

**New endpoint on `UserController`:**

```
GET    /users/:id/groups             List groups the user belongs to
```

### 3c. Frontend — new pages & components

**Redesigned page:**

| Route | Page | Description |
|-------|------|-------------|
| `/groups/[groupId]` | `GroupHubPage` | Tabbed: Feed / Jams / Members / Chat |

**New components:**

| Component | Purpose |
|-----------|---------|
| `GroupHub` | Tabbed container with sub-navigation |
| `PostComposer` | Multi-type composer: dropdown to select type (announcement, looking-for, discussion) |
| `PostCard` | Renders a post; "Looking for" shows instrument badges, "Event" links to jam page |
| `GroupChat` | Message list + input, auto-scroll, cursor-based polling |
| `MemberGrid` | Member avatars with instrument badges + role badges (admin/member) |
| `SuggestedGroups` | Horizontal scroll of suggested groups on `/discover` |

### 3d. Group Chat — architecture

**Phase 1 (this plan):** Polling via REST
- `GET /groups/:id/messages?after=<cursor>` — cursor-based pagination
- Frontend polls every 3s with TanStack Query `refetchInterval: 3000`
- Messages stored in PostgreSQL `group_messages`

**Phase 2 (future):** SSE / WebSocket
- Publish `group.message.created` to Redpanda
- SSE endpoint streams to connected clients
- Reuse agent-service SSE pattern from `knowledge-api.ts`

### 3e. Agent service — group recommendations

New tool: `suggest_groups`
- Takes user's `interests`, `musicianProfiles.genres`, and `location`
- Finds groups with overlapping interests, sorted by member count + proximity
- Returns top 5 with match score

---

## Integration Map

```
                         FRONTEND (Next.js)
                              │
              /discover ── combines musicians + jams + groups
              /musicians ─ browse/filter musicians
              /jams ────── browse/create jam sessions
              /groups/:id ─ group hub (feed + jams + chat + members)
                              │
                    API Gateway (:3000)
                    ┌─────────┼─────────┐
                    ▼         ▼          ▼
             user-service  event-svc  agent-svc
                    │         │          │
                    │   NATS / Redpanda  │
                    ▼         ▼          ▼
             notification  search     Elasticsearch
               service     service    (musician index)
```

---

## Implementation Order

### Week 1: Musician Profile foundation
1. `musician_profiles` migration + schema in `user-service`
2. Extend `UpdateProfileDto` with musician fields
3. `PUT /users/profile/musician` endpoint (upsert)
4. `GET /users/musicians` endpoint with filtering
5. `MusicianProfileForm` + onboarding wizard
6. `/musicians` browse page

### Week 2: Jam Sessions
1. Add columns to `events` table + migration
2. `CreateJamSessionDto` + validator
3. Jam session endpoints (create, browse, RSVP, attendees)
4. `CreateJamForm` + `/jams/new` page
5. `/jams` browse page + `/jams/[id]` detail page
6. RSVP with optimistic UI

### Week 3: Discovery Feed + Group Hub
1. `GET /users/discover/for-you` endpoint (combined feed)
2. `/discover` page with `DiscoveryFeed`
3. `group_messages` + `group_posts` migrations
4. Group post + message endpoints
5. `GroupHubPage` redesign (tabs)
6. `GroupChat` component (polling)

### Week 4: Polish + Agent + Elasticsearch
1. ES index for `musician_profiles`
2. Agent tools: `search_musicians`, `suggest_groups`
3. NATS events for real-time updates
4. `SuggestedGroups` on `/discover`
5. E2E testing + seed data

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `events.vendorId` NOT NULL constraint conflicts with jam sessions | Make `vendorId` nullable; add CHECK constraint for `FORMAL` type |
| Group chat at scale (1000s of messages) | Cursor-based pagination from day 1; Redis cache for recent messages |
| Empty musician profiles = empty discovery feed | Onboarding wizard forced after signup; "complete your profile" prompt on `/discover` |
| Frontend state complexity (3 new pages, multiple stores) | Dedicated TanStack Query keys per flow; Zustand only for auth + current musician profile |
| `eventInvitations` reused for RSVPs — different semantics | RSVP creates invitation with `type=USER_REQUEST`, `status=ACCEPTED`; deletion removes it |
