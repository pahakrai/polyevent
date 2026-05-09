-- Neon Database Dump: vendor_db
-- Generated: 2026-05-10
-- Source: Neon project cool-heart-97084290 (polyevent), branch br-solitary-bread-an7s2n25 (production)

-- Create enum types
DO $$ BEGIN
    CREATE TYPE pricing_model AS ENUM ('FREE', 'PER_HOUR', 'CONTRACT', 'MIXED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE time_slot_status AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED', 'MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE vendor_category AS ENUM ('MUSIC', 'ART', 'SPORTS', 'ACTIVITIES', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE venue_type AS ENUM ('INDOOR', 'OUTDOOR', 'STUDIO', 'GALLERY', 'FIELD', 'COURT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id text NOT NULL,
    user_id text NOT NULL,
    business_name text NOT NULL,
    description text,
    category vendor_category NOT NULL,
    sub_category text,
    contact_email text NOT NULL,
    contact_phone text NOT NULL,
    website text,
    address jsonb NOT NULL DEFAULT '{}'::jsonb,
    location jsonb NOT NULL DEFAULT '{}'::jsonb,
    cover_image text,
    verification_status text NOT NULL DEFAULT 'PENDING'::text,
    rating real NOT NULL DEFAULT 0,
    total_reviews integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT vendors_pkey PRIMARY KEY (id),
    CONSTRAINT vendors_user_id_key UNIQUE (user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS vendors_pkey ON public.vendors USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS vendors_user_id_key ON public.vendors USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS vendors_user_id_idx ON public.vendors USING btree (user_id);

-- Create venues table
CREATE TABLE IF NOT EXISTS venues (
    id text NOT NULL,
    vendor_id text NOT NULL,
    name text NOT NULL,
    description text,
    type venue_type NOT NULL,
    capacity integer NOT NULL,
    address jsonb NOT NULL DEFAULT '{}'::jsonb,
    location jsonb NOT NULL DEFAULT '{}'::jsonb,
    amenities text[] NOT NULL DEFAULT '{}'::text[],
    images text[] NOT NULL DEFAULT '{}'::text[],
    pricing_model pricing_model NOT NULL DEFAULT 'PER_HOUR'::pricing_model,
    hourly_rate real,
    is_available boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT venues_pkey PRIMARY KEY (id),
    CONSTRAINT venues_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS venues_pkey ON public.venues USING btree (id);
CREATE INDEX IF NOT EXISTS venues_vendor_id_idx ON public.venues USING btree (vendor_id);

-- Create time_slots table
CREATE TABLE IF NOT EXISTS time_slots (
    id text NOT NULL,
    venue_id text NOT NULL,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    status time_slot_status NOT NULL DEFAULT 'AVAILABLE'::time_slot_status,
    recurrence_rule text,
    price_override jsonb,
    max_bookings integer NOT NULL DEFAULT 1,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT time_slots_pkey PRIMARY KEY (id),
    CONSTRAINT time_slots_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS time_slots_pkey ON public.time_slots USING btree (id);
CREATE INDEX IF NOT EXISTS time_slots_venue_id_idx ON public.time_slots USING btree (venue_id);

-- ============================================================
-- DATA INSERTS
-- ============================================================

-- Vendors
INSERT INTO vendors (id, user_id, business_name, description, category, sub_category, contact_email, contact_phone, website, address, location, cover_image, verification_status, rating, total_reviews, is_active, created_at, updated_at) VALUES
('v1', 'user_musician_1', 'Harmony Studios', 'Premium music recording and rehearsal studio in downtown LA', 'MUSIC', 'Recording Studio', 'contact@harmonystudios.com', '+1-323-555-0101', 'https://harmonystudios.com', '{"zip":"90028","city":"Los Angeles","state":"CA","street":"123 Melody Ave"}', '{"type":"Point","coordinates":[-118.3267,34.0983]}', 'https://images.example.com/harmony-cover.jpg', 'VERIFIED', 4.8, 245, true, '2026-05-09 02:53:07.280', '2026-05-09 02:53:07.280'),
('v2', 'user_artist_1', 'Canvas & Cork Gallery', 'Contemporary art gallery and wine bar hosting weekly exhibitions', 'ART', 'Gallery', 'info@canvasandcork.com', '+1-415-555-0202', 'https://canvasandcork.com', '{"zip":"94103","city":"San Francisco","state":"CA","street":"456 Gallery Row"}', '{"type":"Point","coordinates":[-122.4015,37.7823]}', 'https://images.example.com/canvas-cover.jpg', 'VERIFIED', 4.5, 128, true, '2026-05-09 02:53:07.280', '2026-05-09 02:53:07.280'),
('v3', 'user_coach_1', 'Peak Performance Sports', 'Elite sports training and event management for youth athletics', 'SPORTS', 'Training', 'team@peakperformancesports.com', '+1-512-555-0303', 'https://peakperformancesports.com', '{"zip":"78701","city":"Austin","state":"TX","street":"789 Champion Dr"}', '{"type":"Point","coordinates":[-97.7431,30.2672]}', 'https://images.example.com/peak-cover.jpg', 'PENDING', 3.2, 42, true, '2026-05-09 02:53:07.280', '2026-05-09 02:53:07.280'),
('v4', 'user_planner_1', 'Eventful Moments', 'Corporate event planning and team building activities', 'ACTIVITIES', 'Corporate Events', 'hello@eventfulmoments.com', '+1-212-555-0404', 'https://eventfulmoments.com', '{"zip":"10001","city":"New York","state":"NY","street":"10 Manhattan Plaza"}', '{"type":"Point","coordinates":[-73.9967,40.7484]}', 'https://images.example.com/eventful-cover.jpg', 'VERIFIED', 4.9, 312, true, '2026-05-09 02:53:07.280', '2026-05-09 02:53:07.280'),
('v5', 'user_musician_2', 'Rhythm & Blues Academy', 'Music school offering private and group lessons', 'MUSIC', 'Music School', 'learn@rhythmandblues.com', '+1-615-555-0505', 'https://rhythmandblues.com', '{"zip":"37203","city":"Nashville","state":"TN","street":"321 Music Row"}', '{"type":"Point","coordinates":[-86.7816,36.1627]}', 'https://images.example.com/rhythm-cover.jpg', 'PENDING', 0, 0, true, '2026-05-09 02:53:07.280', '2026-05-09 02:53:07.280'),
('v6', 'user_artist_2', 'Sculpture Garden Collective', 'Outdoor sculpture park and art workshop space', 'ART', 'Sculpture Park', 'hello@sculpturegarden.com', '+1-303-555-0606', 'https://sculpturegarden.com', '{"zip":"80204","city":"Denver","state":"CO","street":"555 Arts District Blvd"}', '{"type":"Point","coordinates":[-105.0258,39.7392]}', 'https://images.example.com/sculpture-cover.jpg', 'VERIFIED', 4.7, 189, true, '2026-05-09 02:53:07.280', '2026-05-09 02:53:07.280'),
('v7', 'user_coach_2', 'Ace Tennis Academy', 'Professional tennis coaching and tournament organization', 'SPORTS', 'Tennis', 'coach@acetennis.com', '+1-305-555-0707', 'https://acetennis.com', '{"zip":"33130","city":"Miami","state":"FL","street":"88 Court Ave"}', '{"type":"Point","coordinates":[-80.1918,25.7617]}', 'https://images.example.com/ace-cover.jpg', 'VERIFIED', 4.3, 76, true, '2026-05-09 02:53:07.280', '2026-05-09 02:53:07.280'),
('v8', 'user_other_1', 'Zen Garden Wellness', 'Wellness retreats, yoga sessions, and meditation workshops', 'OTHER', 'Wellness', 'peace@zengardenwellness.com', '+1-808-555-0808', 'https://zengardenwellness.com', '{"zip":"96815","city":"Honolulu","state":"HI","street":"777 Aloha Beach Rd"}', '{"type":"Point","coordinates":[-157.8266,21.2766]}', 'https://images.example.com/zen-cover.jpg', 'VERIFIED', 4.6, 156, true, '2026-05-09 02:53:07.280', '2026-05-09 02:53:07.280')
ON CONFLICT (id) DO NOTHING;

-- Venues
INSERT INTO venues (id, vendor_id, name, description, type, capacity, address, location, amenities, images, pricing_model, hourly_rate, is_available, created_at) VALUES
('vn1', 'v1', 'Studio A - The Vault', 'Premium recording studio with vintage analog gear', 'STUDIO', 15, '{"zip":"90028","city":"Los Angeles","state":"CA","street":"123 Melody Ave"}', '{"type":"Point","coordinates":[-118.3267,34.0983]}', '{Parking,WiFi,Sound System,Green Room}', '{}', 'PER_HOUR', 150, true, '2026-05-09 02:54:49.130'),
('vn2', 'v1', 'Rehearsal Room B', 'Spacious rehearsal space with full backline', 'INDOOR', 8, '{"zip":"90028","city":"Los Angeles","state":"CA","street":"123 Melody Ave"}', '{"type":"Point","coordinates":[-118.3267,34.0983]}', '{WiFi,Mirrors,Sound System}', '{}', 'PER_HOUR', 75, true, '2026-05-09 02:54:49.130'),
('vn3', 'v1', 'The Grand Stage', 'Live performance venue with professional lighting', 'INDOOR', 200, '{"zip":"90028","city":"Los Angeles","state":"CA","street":"123 Melody Ave"}', '{"type":"Point","coordinates":[-118.3267,34.0983]}', '{Parking,WiFi,Stage Lighting,Sound System,Bar,Backstage}', '{}', 'PER_HOUR', 500, true, '2026-05-09 02:54:49.130'),
('vn4', 'v2', 'Main Exhibition Hall', 'Contemporary gallery space with rotating exhibits', 'GALLERY', 100, '{"zip":"94103","city":"San Francisco","state":"CA","street":"456 Gallery Row"}', '{"type":"Point","coordinates":[-122.4015,37.7823]}', '{WiFi,Lighting,Hanging System,Wine Bar}', '{}', 'PER_HOUR', 200, true, '2026-05-09 02:54:49.130'),
('vn5', 'v2', 'Art Workshop Studio', 'Hands-on art creation space for classes and events', 'STUDIO', 25, '{"zip":"94103","city":"San Francisco","state":"CA","street":"456 Gallery Row"}', '{"type":"Point","coordinates":[-122.4015,37.7823]}', '{WiFi,Easels,Sink,Storage}', '{}', 'PER_HOUR', 100, true, '2026-05-09 02:54:49.130'),
('vn6', 'v3', 'Victory Field', 'Full-size outdoor training field', 'FIELD', 60, '{"zip":"78701","city":"Austin","state":"TX","street":"789 Champion Dr"}', '{"type":"Point","coordinates":[-97.7431,30.2672]}', '{Parking,Locker Rooms,Floodlights,Scoreboard}', '{}', 'PER_HOUR', 120, true, '2026-05-09 02:54:49.130'),
('vn7', 'v3', 'Performance Court', 'Indoor basketball and volleyball court', 'COURT', 30, '{"zip":"78701","city":"Austin","state":"TX","street":"789 Champion Dr"}', '{"type":"Point","coordinates":[-97.7431,30.2672]}', '{WiFi,Bleachers,Scoreboard,Equipment}', '{}', 'PER_HOUR', 90, true, '2026-05-09 02:54:49.130'),
('vn8', 'v4', 'Manhattan Conference Center', 'Executive conference facility with full AV setup', 'INDOOR', 300, '{"zip":"10001","city":"New York","state":"NY","street":"10 Manhattan Plaza"}', '{"type":"Point","coordinates":[-73.9967,40.7484]}', '{WiFi,AV System,Catering,Breakout Rooms,Parking}', '{}', 'CONTRACT', 350, true, '2026-05-09 02:54:49.130'),
('vn9', 'v4', 'Rooftop Garden Terrace', 'Outdoor event space with Manhattan skyline views', 'OUTDOOR', 150, '{"zip":"10001","city":"New York","state":"NY","street":"10 Manhattan Plaza"}', '{"type":"Point","coordinates":[-73.9967,40.7484]}', '{WiFi,Tenting,Lighting,Bar,Catering}', '{}', 'PER_HOUR', 200, true, '2026-05-09 02:54:49.130'),
('vn10', 'v5', 'Teaching Studio 1', 'Private lesson room with piano and guitar equipment', 'STUDIO', 5, '{"zip":"37203","city":"Nashville","state":"TN","street":"321 Music Row"}', '{"type":"Point","coordinates":[-86.7816,36.1627]}', '{WiFi,Piano,Guitar Amps,Music Stands}', '{}', 'PER_HOUR', 50, true, '2026-05-09 02:54:49.130'),
('vn11', 'v5', 'Group Class Room', 'Larger room for group lessons and ensemble practice', 'INDOOR', 12, '{"zip":"37203","city":"Nashville","state":"TN","street":"321 Music Row"}', '{"type":"Point","coordinates":[-86.7816,36.1627]}', '{WiFi,Whiteboard,Sound System,Drum Kit}', '{}', 'PER_HOUR', 50, true, '2026-05-09 02:54:49.130'),
('vn12', 'v6', 'Open Air Sculpture Park', 'Expansive outdoor gallery surrounded by nature', 'OUTDOOR', 500, '{"zip":"80204","city":"Denver","state":"CO","street":"555 Arts District Blvd"}', '{"type":"Point","coordinates":[-105.0258,39.7392]}', '{Parking,Lighting,Walking Paths,Cafe}', '{}', 'PER_HOUR', 300, true, '2026-05-09 02:54:49.130'),
('vn13', 'v6', 'Clay & Kiln Workshop', 'Ceramics studio with wheels and kilns', 'STUDIO', 40, '{"zip":"80204","city":"Denver","state":"CO","street":"555 Arts District Blvd"}', '{"type":"Point","coordinates":[-105.0258,39.7392]}', '{WiFi,Pottery Wheels,Kilns,Glaze Station,Sink}', '{}', 'PER_HOUR', 150, true, '2026-05-09 02:54:49.130'),
('vn14', 'v7', 'Championship Center Court', 'Professional-grade tennis court with spectator seating', 'COURT', 500, '{"zip":"33130","city":"Miami","state":"FL","street":"88 Court Ave"}', '{"type":"Point","coordinates":[-80.1918,25.7617]}', '{Parking,Bleachers,Floodlights,Locker Rooms,Pro Shop}', '{}', 'PER_HOUR', 200, true, '2026-05-09 02:54:49.130'),
('vn15', 'v7', 'Training Court 1', 'Practice court with ball machine', 'COURT', 50, '{"zip":"33130","city":"Miami","state":"FL","street":"88 Court Ave"}', '{"type":"Point","coordinates":[-80.1918,25.7617]}', '{Ball Machine,Shade Canopy,Water Station}', '{}', 'PER_HOUR', 80, true, '2026-05-09 02:54:49.130'),
('vn16', 'v7', 'Training Court 2', 'Practice court with video analysis setup', 'COURT', 50, '{"zip":"33130","city":"Miami","state":"FL","street":"88 Court Ave"}', '{"type":"Point","coordinates":[-80.1918,25.7617]}', '{Video Analysis,Ball Machine,Shade Canopy}', '{}', 'PER_HOUR', 80, true, '2026-05-09 02:54:49.130'),
('vn17', 'v8', 'Oceanview Yoga Pavilion', 'Open-air yoga space with ocean views', 'OUTDOOR', 40, '{"zip":"96815","city":"Honolulu","state":"HI","street":"777 Aloha Beach Rd"}', '{"type":"Point","coordinates":[-157.8266,21.2766]}', '{Mats,Sound System,Shade,Ocean View}', '{}', 'PER_HOUR', 100, true, '2026-05-09 02:54:49.130'),
('vn18', 'v8', 'Tranquil Meditation Hall', 'Soundproof meditation room with ambient lighting', 'INDOOR', 15, '{"zip":"96815","city":"Honolulu","state":"HI","street":"777 Aloha Beach Rd"}', '{"type":"Point","coordinates":[-157.8266,21.2766]}', '{Cushions,Ambient Lighting,Sound System,Aromatherapy}', '{}', 'PER_HOUR', 80, true, '2026-05-09 02:54:49.130')
ON CONFLICT (id) DO NOTHING;

-- Time Slots
INSERT INTO time_slots (id, venue_id, start_time, end_time, status, recurrence_rule, price_override, max_bookings, created_at, updated_at) VALUES
('ts1','vn1','2026-04-15 09:00:00','2026-04-15 13:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts2','vn1','2026-04-18 14:00:00','2026-04-18 20:00:00','BOOKED',NULL,'{"reason":"Weekend premium","custom_rate":200}',1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts3','vn1','2026-04-22 10:00:00','2026-04-22 16:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts4','vn1','2026-05-02 09:00:00','2026-05-02 12:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts5','vn1','2026-05-10 13:00:00','2026-05-10 19:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts6','vn1','2026-05-15 10:00:00','2026-05-15 14:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts7','vn1','2026-05-20 09:00:00','2026-05-20 17:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts8','vn2','2026-04-10 10:00:00','2026-04-10 12:00:00','BOOKED',NULL,'{"reason":"Band rehearsal package","custom_rate":90}',1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts9','vn2','2026-04-14 14:00:00','2026-04-14 17:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts10','vn2','2026-04-20 10:00:00','2026-04-20 13:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts11','vn2','2026-05-01 09:00:00','2026-05-01 11:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts12','vn2','2026-05-12 15:00:00','2026-05-12 18:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts13','vn3','2026-04-12 18:00:00','2026-04-12 23:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts14','vn3','2026-04-19 17:00:00','2026-04-19 23:00:00','BOOKED',NULL,'{"reason":"Live concert event","custom_rate":600}',1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts15','vn3','2026-04-26 19:00:00','2026-04-26 23:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts16','vn3','2026-05-03 18:00:00','2026-05-03 23:00:00','BOOKED',NULL,'{"reason":"Album release party","custom_rate":650}',1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts17','vn3','2026-05-17 19:00:00','2026-05-17 23:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts18','vn3','2026-05-24 18:00:00','2026-05-24 23:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts19','vn3','2026-05-31 20:00:00','2026-05-31 23:00:00','BLOCKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts20','vn4','2026-04-08 10:00:00','2026-04-08 18:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:55:44.173','2026-05-09 02:55:44.173'),
('ts21','vn4','2026-04-15 11:00:00','2026-04-15 20:00:00','BOOKED',NULL,'{"reason":"Opening night gala","custom_rate":250}',1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts22','vn4','2026-04-25 10:00:00','2026-04-25 18:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts23','vn4','2026-05-05 12:00:00','2026-05-05 20:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts24','vn4','2026-05-15 10:00:00','2026-05-15 18:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts25','vn5','2026-04-13 09:00:00','2026-04-13 12:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts26','vn5','2026-04-20 14:00:00','2026-04-20 17:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts27','vn5','2026-05-08 10:00:00','2026-05-08 13:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts28','vn5','2026-05-18 09:00:00','2026-05-18 12:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts29','vn6','2026-04-11 08:00:00','2026-04-11 12:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts30','vn6','2026-04-18 13:00:00','2026-04-18 17:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts31','vn6','2026-05-02 08:00:00','2026-05-02 12:00:00','BLOCKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts32','vn6','2026-05-16 14:00:00','2026-05-16 18:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts33','vn7','2026-04-16 15:00:00','2026-04-16 18:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts34','vn7','2026-04-23 10:00:00','2026-04-23 13:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts35','vn7','2026-05-09 14:00:00','2026-05-09 17:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts36','vn8','2026-04-09 08:00:00','2026-04-09 18:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts37','vn8','2026-04-17 08:00:00','2026-04-17 18:00:00','BOOKED',NULL,'{"reason":"Tech conference day pass","custom_rate":400}',1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts38','vn8','2026-04-24 09:00:00','2026-04-24 17:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts39','vn8','2026-05-01 08:00:00','2026-05-01 20:00:00','BOOKED',NULL,'{"reason":"Annual summit","custom_rate":500}',1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts40','vn8','2026-05-12 09:00:00','2026-05-12 17:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:56:28.735','2026-05-09 02:56:28.735'),
('ts41','vn8','2026-05-22 09:00:00','2026-05-22 17:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts42','vn9','2026-04-14 16:00:00','2026-04-14 22:00:00','BOOKED',NULL,'{"reason":"Corporate happy hour","custom_rate":250}',1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts43','vn9','2026-04-21 17:00:00','2026-04-21 23:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts44','vn9','2026-05-05 16:00:00','2026-05-05 22:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts45','vn9','2026-05-19 17:00:00','2026-05-19 23:00:00','BOOKED',NULL,'{"reason":"Summer kickoff party","custom_rate":300}',1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts46','vn10','2026-04-10 15:00:00','2026-04-10 16:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts47','vn10','2026-04-22 14:00:00','2026-04-22 15:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts48','vn10','2026-05-06 15:00:00','2026-05-06 16:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts49','vn11','2026-04-17 10:00:00','2026-04-17 12:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts50','vn11','2026-05-08 10:00:00','2026-05-08 12:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts51','vn12','2026-04-12 10:00:00','2026-04-12 18:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts52','vn12','2026-04-19 10:00:00','2026-04-19 18:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts53','vn12','2026-04-26 09:00:00','2026-04-26 17:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts54','vn12','2026-05-03 10:00:00','2026-05-03 18:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts55','vn12','2026-05-17 09:00:00','2026-05-17 17:00:00','BOOKED',NULL,'{"reason":"Sculpture festival","custom_rate":400}',1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts56','vn12','2026-05-24 10:00:00','2026-05-24 18:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts57','vn13','2026-04-15 09:00:00','2026-04-15 12:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts58','vn13','2026-04-28 14:00:00','2026-04-28 17:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts59','vn13','2026-05-10 09:00:00','2026-05-10 13:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts60','vn13','2026-05-20 14:00:00','2026-05-20 17:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:57:12.788','2026-05-09 02:57:12.788'),
('ts61','vn14','2026-04-10 09:00:00','2026-04-10 15:00:00','BOOKED',NULL,'{"reason":"Regional tournament","custom_rate":250}',1,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts62','vn14','2026-04-17 10:00:00','2026-04-17 16:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts63','vn14','2026-04-24 09:00:00','2026-04-24 17:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts64','vn14','2026-05-03 10:00:00','2026-05-03 16:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts65','vn14','2026-05-15 09:00:00','2026-05-15 15:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts66','vn15','2026-04-11 08:00:00','2026-04-11 10:00:00','BOOKED',NULL,NULL,2,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts67','vn15','2026-04-14 15:00:00','2026-04-14 17:00:00','BOOKED',NULL,NULL,2,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts68','vn15','2026-04-21 08:00:00','2026-04-21 10:00:00','BOOKED',NULL,NULL,2,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts69','vn15','2026-04-28 14:00:00','2026-04-28 16:00:00','BOOKED',NULL,NULL,2,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts70','vn15','2026-05-05 08:00:00','2026-05-05 10:00:00','BOOKED',NULL,NULL,2,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts71','vn15','2026-05-19 15:00:00','2026-05-19 17:00:00','AVAILABLE',NULL,NULL,2,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts72','vn16','2026-04-09 10:00:00','2026-04-09 12:00:00','BOOKED',NULL,NULL,2,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts73','vn16','2026-04-16 16:00:00','2026-04-16 18:00:00','BOOKED',NULL,NULL,2,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts74','vn16','2026-05-07 10:00:00','2026-05-07 12:00:00','BOOKED',NULL,NULL,2,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts75','vn16','2026-05-21 16:00:00','2026-05-21 18:00:00','MAINTENANCE',NULL,NULL,2,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts76','vn17','2026-04-13 07:00:00','2026-04-13 09:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts77','vn17','2026-04-16 07:00:00','2026-04-16 09:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts78','vn17','2026-04-20 17:00:00','2026-04-20 19:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts79','vn17','2026-04-27 07:00:00','2026-04-27 09:00:00','BOOKED',NULL,'{"reason":"Sunrise yoga special","custom_rate":120}',1,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts80','vn17','2026-05-04 17:00:00','2026-05-04 19:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:57:56.184','2026-05-09 02:57:56.184'),
('ts81','vn17','2026-05-11 07:00:00','2026-05-11 09:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:58:18.728','2026-05-09 02:58:18.728'),
('ts82','vn17','2026-05-18 17:00:00','2026-05-18 19:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:58:18.728','2026-05-09 02:58:18.728'),
('ts83','vn18','2026-04-14 08:00:00','2026-04-14 10:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:58:18.728','2026-05-09 02:58:18.728'),
('ts84','vn18','2026-04-18 18:00:00','2026-04-18 20:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:58:18.728','2026-05-09 02:58:18.728'),
('ts85','vn18','2026-04-25 08:00:00','2026-04-25 10:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:58:18.728','2026-05-09 02:58:18.728'),
('ts86','vn18','2026-04-30 18:00:00','2026-04-30 20:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:58:18.728','2026-05-09 02:58:18.728'),
('ts87','vn18','2026-05-06 08:00:00','2026-05-06 10:00:00','BOOKED',NULL,NULL,1,'2026-05-09 02:58:18.728','2026-05-09 02:58:18.728'),
('ts88','vn18','2026-05-14 18:00:00','2026-05-14 20:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:58:18.728','2026-05-09 02:58:18.728'),
('ts89','vn18','2026-05-25 08:00:00','2026-05-25 10:00:00','AVAILABLE',NULL,NULL,1,'2026-05-09 02:58:18.728','2026-05-09 02:58:18.728')
ON CONFLICT (id) DO NOTHING;
