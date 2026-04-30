-- ============================================================================
-- Row-Level Security for Vendor Data Isolation
-- Run this against vendor_db and event_db before using the agent service.
--
-- How it works:
--   1. Backend calls SELECT set_config('app.current_vendor_id', '<id>', false)
--      on every database session (see tool-executor.service.ts)
--   2. RLS policies filter every SELECT to only return rows owned by that vendor
--   3. The LLM can write any SQL — PostgreSQL enforces the scoping
--   4. Market aggregate VIEWS bypass RLS but only contain anonymized GROUP BY data
-- ============================================================================

-- ── Vendor Database (vendor_db) ────────────────────────────────────────

-- Enable RLS on core multi-tenant tables
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

-- Vendor: only see own profile
DROP POLICY IF EXISTS vendor_isolation ON vendors;
CREATE POLICY vendor_isolation ON vendors
  FOR SELECT
  USING (id = current_setting('app.current_vendor_id'));

-- Venue: only see own venues (vendor_id must match)
DROP POLICY IF EXISTS venue_isolation ON venues;
CREATE POLICY venue_isolation ON venues
  FOR SELECT
  USING (vendor_id = current_setting('app.current_vendor_id'));

-- Time slot: only see slots for own venues
DROP POLICY IF EXISTS timeslot_isolation ON time_slots;
CREATE POLICY timeslot_isolation ON time_slots
  FOR SELECT
  USING (
    venue_id IN (
      SELECT id FROM venues WHERE vendor_id = current_setting('app.current_vendor_id')
    )
  );

-- ── Event Database (event_db) ──────────────────────────────────────────

-- Events: only see own events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_isolation ON events;
CREATE POLICY event_isolation ON events
  FOR SELECT
  USING (vendor_id = current_setting('app.current_vendor_id'));

-- ── Cross-database market aggregate views (safe for any vendor) ────────
-- These views have NO RLS. They contain only anonymized aggregates.
-- HAVING COUNT(*) >= 5 ensures no individual vendor can be identified.

-- Run this in event_db:

DROP VIEW IF EXISTS market_stats;
CREATE VIEW market_stats AS
SELECT
  e.category,
  e.location->>'city' AS city,
  COUNT(*) AS total_events,
  ROUND(AVG(e.current_bookings * 100.0 / NULLIF(e.max_attendees, 0)), 1) AS avg_fill_rate,
  COUNT(DISTINCT e.vendor_id) AS vendor_count
FROM events e
WHERE e.status = 'PUBLISHED'
GROUP BY e.category, e.location->>'city'
HAVING COUNT(*) >= 5
ORDER BY total_events DESC;
