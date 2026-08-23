/**
 * Shared Jest setup.
 *
 * Service `database/client.ts` files throw at import time when their
 * `*_DATABASE_URL` env var is missing. Unit tests that import a service (and
 * therefore its database client) need a dummy URL present before module load.
 * The values are never actually connected to — `pg.Pool` connects lazily.
 */
const DUMMY_DB_URLS: Record<string, string> = {
  AUTH_DATABASE_URL: 'postgresql://test:test@localhost:5432/auth_db',
  USER_DATABASE_URL: 'postgresql://test:test@localhost:5432/user_db',
  VENDOR_DATABASE_URL: 'postgresql://test:test@localhost:5432/vendor_db',
  EVENT_DATABASE_URL: 'postgresql://test:test@localhost:5432/event_db',
  BOOKING_DATABASE_URL: 'postgresql://test:test@localhost:5432/booking_db',
  NOTIFICATION_DATABASE_URL: 'postgresql://test:test@localhost:5432/notification_db',
  ADMIN_DATABASE_URL: 'postgresql://test:test@localhost:5432/admin_db',
};

for (const [key, value] of Object.entries(DUMMY_DB_URLS)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
