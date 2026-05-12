/**
 * Generates 0001_sample_data.sql migration files for each service.
 * Reads sample-data-constants.ts and produces SQL INSERT statements.
 *
 * Usage: npx tsx scripts/sample-data/generate-sql-migrations.ts
 */
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import {
  SAMPLE_USERS,
  SAMPLE_VENDORS,
  SAMPLE_VENUES,
  SAMPLE_EVENTS,
} from './sample-data-constants';

const SALT_ROUNDS = 10;

// ===== Booking data (from booking-service seed.ts) =====
const SAMPLE_BOOKINGS = [
  { id: 'booking-001', userId: 'user-001', eventId: 'event-001', vendorId: 'vendor-001', ticketCount: 2, totalAmount: 50.0, currency: 'EUR', status: 'ATTENDED', ticketType: 'GENERAL', source: 'web', metadata: { notes: 'Jazz night booking' } },
  { id: 'booking-002', userId: 'user-002', eventId: 'event-002', vendorId: 'vendor-001', ticketCount: 1, totalAmount: 40.0, currency: 'EUR', status: 'CONFIRMED', ticketType: 'STUDENT', source: 'mobile', metadata: { notes: 'Workshop booking' } },
  { id: 'booking-003', userId: 'user-003', eventId: 'event-003', vendorId: 'vendor-002', ticketCount: 3, totalAmount: 96.0, currency: 'EUR', status: 'CONFIRMED', ticketType: 'GENERAL', source: 'web', metadata: {} },
  { id: 'booking-004', userId: 'user-004', eventId: 'event-004', vendorId: 'vendor-002', ticketCount: 2, totalAmount: 70.0, currency: 'EUR', status: 'ATTENDED', ticketType: 'GENERAL', promoCode: 'EARLY10', discountAmount: 7.0, source: 'web', metadata: {} },
  { id: 'booking-005', userId: 'user-005', eventId: 'event-005', vendorId: 'vendor-003', ticketCount: 4, totalAmount: 200.0, currency: 'EUR', status: 'CONFIRMED', ticketType: 'VIP', source: 'mobile', metadata: {} },
  { id: 'booking-006', userId: 'user-006', eventId: 'event-006', vendorId: 'vendor-003', ticketCount: 1, totalAmount: 0.0, currency: 'EUR', status: 'ATTENDED', ticketType: 'FREE', source: 'web', metadata: {} },
  { id: 'booking-007', userId: 'user-007', eventId: 'event-007', vendorId: 'vendor-004', ticketCount: 2, totalAmount: 60.0, currency: 'EUR', status: 'CANCELLED', ticketType: 'GENERAL', source: 'web', metadata: { cancelReason: 'Schedule conflict' } },
  { id: 'booking-008', userId: 'user-008', eventId: 'event-008', vendorId: 'vendor-004', ticketCount: 1, totalAmount: 35.0, currency: 'EUR', status: 'ATTENDED', ticketType: 'GENERAL', source: 'app', metadata: {} },
  { id: 'booking-009', userId: 'user-009', eventId: 'event-009', vendorId: 'vendor-005', ticketCount: 3, totalAmount: 75.0, currency: 'EUR', status: 'CONFIRMED', ticketType: 'GENERAL', source: 'web', metadata: {} },
  { id: 'booking-010', userId: 'user-010', eventId: 'event-010', vendorId: 'vendor-005', ticketCount: 2, totalAmount: 90.0, currency: 'EUR', status: 'ATTENDED', ticketType: 'VIP', promoCode: 'VIP20', discountAmount: 18.0, source: 'app', metadata: {} },
  { id: 'booking-011', userId: 'user-011', eventId: 'event-011', vendorId: 'vendor-006', ticketCount: 1, totalAmount: 25.0, currency: 'EUR', status: 'CONFIRMED', ticketType: 'GENERAL', source: 'web', metadata: {} },
  { id: 'booking-012', userId: 'user-012', eventId: 'event-012', vendorId: 'vendor-006', ticketCount: 1, totalAmount: 30.0, currency: 'EUR', status: 'NO_SHOW', ticketType: 'GENERAL', source: 'web', metadata: {} },
  { id: 'booking-013', userId: 'user-013', eventId: 'event-013', vendorId: 'vendor-007', ticketCount: 2, totalAmount: 50.0, currency: 'EUR', status: 'ATTENDED', ticketType: 'GENERAL', source: 'mobile', metadata: {} },
  { id: 'booking-014', userId: 'user-014', eventId: 'event-014', vendorId: 'vendor-007', ticketCount: 1, totalAmount: 25.0, currency: 'EUR', status: 'REFUNDED', ticketType: 'GENERAL', source: 'web', metadata: { refundReason: 'Event cancelled' } },
  { id: 'booking-015', userId: 'user-015', eventId: 'event-015', vendorId: 'vendor-008', ticketCount: 3, totalAmount: 135.0, currency: 'EUR', status: 'CONFIRMED', ticketType: 'VIP', source: 'app', metadata: {} },
  { id: 'booking-016', userId: 'user-001', eventId: 'event-016', vendorId: 'vendor-001', ticketCount: 2, totalAmount: 60.0, currency: 'EUR', status: 'ATTENDED', ticketType: 'GENERAL', source: 'web', metadata: {} },
  { id: 'booking-017', userId: 'user-002', eventId: 'event-017', vendorId: 'vendor-001', ticketCount: 1, totalAmount: 25.0, currency: 'EUR', status: 'CONFIRMED', ticketType: 'GENERAL', source: 'app', metadata: {} },
  { id: 'booking-018', userId: 'user-003', eventId: 'event-018', vendorId: 'vendor-002', ticketCount: 2, totalAmount: 80.0, currency: 'EUR', status: 'ATTENDED', ticketType: 'GENERAL', source: 'web', metadata: {} },
  { id: 'booking-019', userId: 'user-016', eventId: 'event-019', vendorId: 'vendor-008', ticketCount: 1, totalAmount: 20.0, currency: 'EUR', status: 'CONFIRMED', ticketType: 'GENERAL', source: 'mobile', metadata: {} },
  { id: 'booking-020', userId: 'user-017', eventId: 'event-020', vendorId: 'vendor-003', ticketCount: 2, totalAmount: 50.0, currency: 'EUR', status: 'ATTENDED', ticketType: 'GENERAL', source: 'web', metadata: {} },
];

const SAMPLE_PAYMENTS = [
  { id: 'pay-001', bookingId: 'booking-001', amount: 50.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_001' },
  { id: 'pay-002', bookingId: 'booking-002', amount: 40.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_002' },
  { id: 'pay-003', bookingId: 'booking-003', amount: 96.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_003' },
  { id: 'pay-004', bookingId: 'booking-004', amount: 70.0, currency: 'EUR', status: 'COMPLETED', method: 'CREDIT_CARD', stripePaymentIntentId: 'pi_test_004' },
  { id: 'pay-005', bookingId: 'booking-005', amount: 200.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_005' },
  { id: 'pay-006', bookingId: 'booking-006', amount: 0.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_006' },
  { id: 'pay-007', bookingId: 'booking-007', amount: 60.0, currency: 'EUR', status: 'REFUNDED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_007', refundAmount: 60.0, refundReason: 'Customer cancellation' },
  { id: 'pay-008', bookingId: 'booking-008', amount: 35.0, currency: 'EUR', status: 'COMPLETED', method: 'APPLE_PAY', stripePaymentIntentId: 'pi_test_008' },
  { id: 'pay-009', bookingId: 'booking-009', amount: 75.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_009' },
  { id: 'pay-010', bookingId: 'booking-010', amount: 90.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_010' },
  { id: 'pay-011', bookingId: 'booking-011', amount: 25.0, currency: 'EUR', status: 'COMPLETED', method: 'GOOGLE_PAY', stripePaymentIntentId: 'pi_test_011' },
  { id: 'pay-012', bookingId: 'booking-012', amount: 30.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_012' },
  { id: 'pay-013', bookingId: 'booking-013', amount: 50.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_013' },
  { id: 'pay-014', bookingId: 'booking-014', amount: 25.0, currency: 'EUR', status: 'REFUNDED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_014', refundAmount: 25.0, refundReason: 'Event cancelled by vendor' },
  { id: 'pay-015', bookingId: 'booking-015', amount: 135.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_015' },
  { id: 'pay-016', bookingId: 'booking-016', amount: 60.0, currency: 'EUR', status: 'COMPLETED', method: 'PAYPAL', stripePaymentIntentId: 'pi_test_016' },
  { id: 'pay-017', bookingId: 'booking-017', amount: 25.0, currency: 'EUR', status: 'PENDING', method: 'STRIPE', stripePaymentIntentId: 'pi_test_017' },
  { id: 'pay-018', bookingId: 'booking-018', amount: 80.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_018' },
  { id: 'pay-019', bookingId: 'booking-019', amount: 20.0, currency: 'EUR', status: 'COMPLETED', method: 'DEBIT_CARD', stripePaymentIntentId: 'pi_test_019' },
  { id: 'pay-020', bookingId: 'booking-020', amount: 50.0, currency: 'EUR', status: 'COMPLETED', method: 'STRIPE', stripePaymentIntentId: 'pi_test_020' },
];

// ===== SQL escaping =====
function esc(v: string): string {
  return v.replace(/'/g, "''");
}

function jsonStr(obj: unknown): string {
  return esc(JSON.stringify(obj));
}

function nullable(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'string') return `'${esc(v)}'`;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${esc(String(v))}'`;
}

function arrStr(arr: string[]): string {
  if (arr.length === 0) return "'{}'";
  return `'{${arr.map(esc).join(',')}}'`;
}

// ===== Auth service =====
async function generateAuthMigration(): Promise<string> {
  const lines: string[] = [];
  lines.push('-- 0001_sample_data: Seed users and login activities');
  lines.push('-- Generated by scripts/sample-data/generate-sql-migrations.ts');
  lines.push('');

  // Users
  for (const u of SAMPLE_USERS) {
    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    lines.push(`INSERT INTO users (id, email, password, first_name, last_name, phone, role, location, preferences, created_at, updated_at)`);
    lines.push(`VALUES (`);
    lines.push(`  '${esc(u.id)}', '${esc(u.email)}', '${esc(hash)}', '${esc(u.firstName)}', '${esc(u.lastName)}', '${esc(u.phone)}', '${esc(u.role)}',`);
    lines.push(`  '${jsonStr({ city: u.city, country: 'Finland', latitude: u.lat, longitude: u.lng })}',`);
    const prefs = { musicalGenres: u.genres, notificationSettings: { email: true, sms: false, push: true, marketingEmails: false }, searchRadius: u.searchRadius };
    lines.push(`  '${jsonStr(prefs)}',`);
    lines.push(`  NOW(), NOW()`);
    lines.push(`) ON CONFLICT (email) DO NOTHING;`);
    lines.push('');
  }

  // Login activities
  for (const u of SAMPLE_USERS) {
    lines.push(`INSERT INTO user_activities (user_id, event_type, metadata, timestamp, ip_address, user_agent)`);
    lines.push(`SELECT '${esc(u.id)}', 'LOGIN', '${jsonStr({ source: 'seed_script', ip: '127.0.0.1' })}', NOW(), '127.0.0.1', 'SeedScript/1.0'`);
    lines.push(`WHERE NOT EXISTS (SELECT 1 FROM user_activities WHERE user_id = '${esc(u.id)}' AND event_type = 'LOGIN');`);
    lines.push('');
  }

  return `-- Custom migration: sample seed data\n\n${lines.join('\n')}`;
}

// ===== User service =====
function generateUserActivities() {
  const activities: Array<{
    userId: string;
    eventType: string;
    metadata: Record<string, unknown>;
    daysAgo: number;
  }> = [];

  const eventTypes = ['SEARCH', 'VIEW_EVENT', 'BOOKING_CREATED', 'BOOKING_CANCELLED', 'REVIEW_CREATED'];
  const categories = ['MUSIC', 'ART', 'SPORTS', 'ACTIVITIES', 'OTHER'];
  const subCategories: Record<string, string[]> = {
    MUSIC: ['Jazz', 'Rock', 'Classical', 'Electronic', 'Blues', 'Indie', 'Pop', 'Metal', 'Folk', 'Acoustic'],
    ART: ['Exhibition', 'Workshop', 'Photography', 'Sculpture', 'Painting', 'Social', 'Ceramics'],
    SPORTS: ['Basketball', 'Tennis', 'Climbing', 'Volleyball', 'Team Building', 'Camp'],
    ACTIVITIES: ['Yoga', 'Meditation', 'Cooking', 'Outdoor', 'Baking', 'Ceremony', 'Wine Tasting', 'Retreat', 'Kayaking', 'Foraging'],
    OTHER: ['Misc'],
  };
  const cities = ['Helsinki', 'Espoo', 'Vantaa', 'Tampere', 'Turku', 'Oulu', 'Lahti', 'Jyväskylä', 'Kuopio'];
  const sources = ['web', 'mobile', 'app'];
  const searchQueries = [
    'jazz night', 'rock concert', 'art exhibition', 'yoga class', 'tennis', 'cooking workshop',
    'meditation', 'basketball tournament', 'music festival', 'wine tasting', 'outdoor adventure',
    'photography', 'sculpture', 'climbing', 'kayaking', 'baking', 'electronic music', 'summer events',
    'weekend activities', 'live music tonight', 'free events', 'workshops near me', 'family activities',
    'date night ideas', 'fitness classes', 'cultural events', 'food festivals', 'concerts this month',
  ];

  const regularUsers = SAMPLE_USERS.filter(u => u.role === 'USER');
  const rng = (seed: number) => {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0xFFFFFFFF; };
  };

  const now = new Date();

  for (const user of regularUsers) {
    const rand = rng(user.id.charCodeAt(0) * 1000 + user.id.charCodeAt(user.id.length - 1));
    const numActivities = 15 + Math.floor(rand() * 35);

    for (let i = 0; i < numActivities; i++) {
      const eventType = eventTypes[Math.floor(rand() * (i < 3 ? 2 : eventTypes.length))];
      const category = categories[Math.floor(rand() * categories.length)];
      const subs = subCategories[category] || ['Misc'];
      const subCategory = subs[Math.floor(rand() * subs.length)];
      const city = cities[Math.floor(rand() * cities.length)];
      const daysAgo = Math.floor(rand() * 90);
      const source = sources[Math.floor(rand() * sources.length)];
      const searchQuery = searchQueries[Math.floor(rand() * searchQueries.length)];

      let metadata: Record<string, unknown> = {
        category, subCategory, city, source,
        timestamp: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
      };

      if (eventType === 'SEARCH') {
        metadata = { ...metadata, query: searchQuery, resultCount: 5 + Math.floor(rand() * 40) };
      } else if (eventType === 'VIEW_EVENT') {
        const eventNum = 1 + Math.floor(rand() * 40);
        metadata = { ...metadata, eventId: `event-${String(eventNum).padStart(3, '0')}`, duration: 5 + Math.floor(rand() * 120) };
      } else if (eventType === 'BOOKING_CREATED') {
        const bookingNum = 1 + Math.floor(rand() * 20);
        metadata = { ...metadata, bookingId: `booking-${String(bookingNum).padStart(3, '0')}`, eventId: `event-${String(1 + Math.floor(rand() * 40)).padStart(3, '0')}`, ticketCount: 1 + Math.floor(rand() * 4), totalAmount: Math.round(rand() * 200 * 100) / 100 };
      } else if (eventType === 'BOOKING_CANCELLED') {
        metadata = { ...metadata, bookingId: `booking-${String(1 + Math.floor(rand() * 20)).padStart(3, '0')}`, cancelReason: ['Schedule conflict', 'Changed mind', 'Found alternative', 'Emergency'][Math.floor(rand() * 4)] };
      } else if (eventType === 'REVIEW_CREATED') {
        metadata = { ...metadata, eventId: `event-${String(1 + Math.floor(rand() * 40)).padStart(3, '0')}`, rating: 3 + Math.floor(rand() * 3), reviewLength: 20 + Math.floor(rand() * 200) };
      }

      activities.push({ userId: user.id, eventType, metadata, daysAgo });
    }
  }

  activities.sort((a, b) => a.daysAgo - b.daysAgo);
  return activities;
}

function generateUserMigration(): string {
  const lines: string[] = [];
  lines.push('-- 0001_sample_data: Seed user profiles and activities');
  lines.push('-- Generated by scripts/sample-data/generate-sql-migrations.ts');
  lines.push('');

  // User profiles
  for (let i = 0; i < SAMPLE_USERS.length; i++) {
    const u = SAMPLE_USERS[i];
    const theme = ['dark', 'light', 'auto'][i % 3];
    const prefs = { theme, notifications: true, interests: u.interests };
    const loc = { city: u.city, country: 'Finland', latitude: u.lat, longitude: u.lng, coordinates: [u.lng, u.lat] };

    lines.push(`INSERT INTO users (id, email, first_name, last_name, phone, role, interests, location, preferences, created_at, updated_at)`);
    lines.push(`VALUES (`);
    lines.push(`  '${esc(u.id)}', '${esc(u.email)}', '${esc(u.firstName)}', '${esc(u.lastName)}', '${esc(u.phone)}', '${esc(u.role)}',`);
    lines.push(`  ${arrStr(u.interests)}, '${jsonStr(loc)}', '${jsonStr(prefs)}', NOW(), NOW()`);
    lines.push(`) ON CONFLICT (email) DO NOTHING;`);
    lines.push('');
  }

  // Activities
  const activities = generateUserActivities();
  let actCount = 0;
  for (const act of activities) {
    const ts = new Date(Date.now() - act.daysAgo * 86400000).toISOString();
    const ua = ['SeedScript/1.0', 'Mozilla/5.0 Mobile', 'Mozilla/5.0 Desktop'][act.daysAgo % 3];
    lines.push(`INSERT INTO user_activities (user_id, event_type, metadata, timestamp, ip_address, user_agent)`);
    lines.push(`VALUES ('${esc(act.userId)}', '${esc(act.eventType)}', '${jsonStr(act.metadata)}', '${ts}', '127.0.0.1', '${esc(ua)}');`);
    actCount++;
  }

  return `-- Custom migration: sample seed data\n\n${lines.join('\n')}`;
}

// ===== Vendor service =====
function generateTimeSlots() {
  const slots: Array<{
    id: string;
    venueId: string;
    startTime: string;
    endTime: string;
    status: string;
    maxBookings: number;
    priceOverride: string | null;
  }> = [];

  const now = new Date();
  let slotIdx = 1;

  for (const venue of SAMPLE_VENUES) {
    for (let day = 0; day < 30; day++) {
      const date = new Date(now.getTime() + day * 86400000);
      const dateStr = date.toISOString().split('T')[0];

      // Morning slot
      if (day % 3 !== 0) {
        const statuses = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'BOOKED', 'BLOCKED'];
        slots.push({
          id: `ts-${String(slotIdx).padStart(3, '0')}`,
          venueId: venue.id,
          startTime: `${dateStr} 08:00:00+00`,
          endTime: `${dateStr} 12:00:00+00`,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          maxBookings: 1,
          priceOverride: null,
        });
        slotIdx++;
      }

      // Afternoon slot
      if (day % 2 !== 0) {
        const statuses = ['AVAILABLE', 'AVAILABLE', 'BOOKED', 'AVAILABLE', 'MAINTENANCE'];
        const priceOv = day % 7 === 0 ? JSON.stringify({ rate: venue.hourlyRate * 1.5, currency: 'EUR' }) : null;
        slots.push({
          id: `ts-${String(slotIdx).padStart(3, '0')}`,
          venueId: venue.id,
          startTime: `${dateStr} 13:00:00+00`,
          endTime: `${dateStr} 17:00:00+00`,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          maxBookings: 1,
          priceOverride: priceOv,
        });
        slotIdx++;
      }

      // Evening slot
      const statuses = ['AVAILABLE', 'BOOKED', 'AVAILABLE', 'AVAILABLE', 'AVAILABLE'];
      const priceOv = day % 5 === 0 ? JSON.stringify({ rate: venue.hourlyRate * 1.2, currency: 'EUR' }) : null;
      slots.push({
        id: `ts-${String(slotIdx).padStart(3, '0')}`,
        venueId: venue.id,
        startTime: `${dateStr} 18:00:00+00`,
        endTime: `${dateStr} 23:00:00+00`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        maxBookings: 1,
        priceOverride: priceOv,
      });
      slotIdx++;
    }
  }

  return slots;
}

function generateVendorMigration(): string {
  const lines: string[] = [];
  lines.push('-- 0001_sample_data: Seed vendors, venues, and time slots');
  lines.push('-- Generated by scripts/sample-data/generate-sql-migrations.ts');
  lines.push('');

  // Vendors
  for (const v of SAMPLE_VENDORS) {
    const address = { street: v.streetAddress, city: v.city, country: 'Finland' };
    const location = { type: 'Point', coordinates: [v.lng, v.lat] };

    lines.push(`INSERT INTO vendors (id, user_id, business_name, description, category, sub_category, contact_email, contact_phone, website, address, location, verification_status, rating, total_reviews, is_active, created_at, updated_at)`);
    lines.push(`VALUES (`);
    lines.push(`  '${esc(v.id)}', '${esc(v.userId)}', '${esc(v.businessName)}', '${esc(v.description)}', '${esc(v.category)}', '${esc(v.subCategory)}',`);
    lines.push(`  '${esc(v.contactEmail)}', '${esc(v.contactPhone)}', '${esc(v.website)}', '${jsonStr(address)}', '${jsonStr(location)}',`);
    lines.push(`  '${esc(v.verificationStatus)}', ${v.rating}, ${v.totalReviews}, true, NOW(), NOW()`);
    lines.push(`);`);
    lines.push('');
  }

  // Venues
  for (const v of SAMPLE_VENUES) {
    const address = { street: v.streetAddress, city: v.city, country: 'Finland' };
    const location = { type: 'Point', coordinates: [v.lng, v.lat] };

    lines.push(`INSERT INTO venues (id, vendor_id, name, description, type, capacity, address, location, amenities, hourly_rate, is_available, created_at)`);
    lines.push(`VALUES (`);
    lines.push(`  '${esc(v.id)}', '${esc(v.vendorId)}', '${esc(v.name)}', '${esc(v.description)}', '${esc(v.type)}', ${v.capacity},`);
    lines.push(`  '${jsonStr(address)}', '${jsonStr(location)}', ${arrStr(v.amenities)}, ${v.hourlyRate}, true, NOW()`);
    lines.push(`);`);
    lines.push('');
  }

  // Time slots
  const slots = generateTimeSlots();
  for (const s of slots) {
    const po = s.priceOverride ? `'${jsonStr(JSON.parse(s.priceOverride))}'` : 'NULL';
    lines.push(`INSERT INTO time_slots (id, venue_id, start_time, end_time, status, max_bookings, price_override, created_at, updated_at)`);
    lines.push(`VALUES ('${esc(s.id)}', '${esc(s.venueId)}', '${s.startTime}', '${s.endTime}', '${esc(s.status)}', ${s.maxBookings}, ${po}::jsonb, NOW(), NOW());`);
  }

  return `-- Custom migration: sample seed data\n\n${lines.join('\n')}`;
}

// ===== Event service =====
function generateEventMigration(): string {
  const lines: string[] = [];
  lines.push('-- 0001_sample_data: Seed events');
  lines.push('-- Generated by scripts/sample-data/generate-sql-migrations.ts');
  lines.push('');

  for (const e of SAMPLE_EVENTS) {
    const location = { venueName: e.title, address: `${e.city}, Finland`, city: e.city, latitude: e.lat, longitude: e.lng };
    const price = JSON.stringify(e.price);

    lines.push(`INSERT INTO events (id, vendor_id, venue_id, title, description, category, sub_category, start_time, end_time, location, price, pricing_model, max_attendees, current_bookings, status, tags, age_restriction, is_recurring, recurring_rule, created_at, updated_at)`);
    lines.push(`VALUES (`);
    lines.push(`  '${esc(e.id)}', '${esc(e.vendorId)}', '${esc(e.venueId)}', '${esc(e.title)}', '${esc(e.description)}',`);
    lines.push(`  '${esc(e.category)}', '${esc(e.subCategory)}', '${e.startTime}', '${e.endTime}',`);
    lines.push(`  '${jsonStr(location)}', '${esc(price)}', '${esc(e.pricingModel)}', ${e.maxAttendees}, ${e.currentBookings},`);
    lines.push(`  '${esc(e.status)}', ${arrStr(e.tags)}, ${nullable(e.ageRestriction)}, ${e.isRecurring}, ${nullable(e.recurringRule)}, NOW(), NOW()`);
    lines.push(`);`);
    lines.push('');
  }

  return `-- Custom migration: sample seed data\n\n${lines.join('\n')}`;
}

// ===== Booking service =====
function generateBookingMigration(): string {
  const lines: string[] = [];
  lines.push('-- 0001_sample_data: Seed bookings, payments, and booking activities');
  lines.push('-- Generated by scripts/sample-data/generate-sql-migrations.ts');
  lines.push('');

  // Bookings
  for (const b of SAMPLE_BOOKINGS) {
    const meta = JSON.stringify(b.metadata);
    lines.push(`INSERT INTO bookings (id, user_id, event_id, vendor_id, ticket_count, total_amount, currency, status, ticket_type, promo_code, discount_amount, source, metadata, created_at, updated_at)`);
    lines.push(`VALUES (`);
    lines.push(`  '${esc(b.id)}', '${esc(b.userId)}', '${esc(b.eventId)}', '${esc(b.vendorId)}', ${b.ticketCount}, ${b.totalAmount}, '${esc(b.currency)}',`);
    lines.push(`  '${esc(b.status)}', '${esc(b.ticketType)}', ${nullable(b.promoCode || null)}, ${nullable(b.discountAmount ?? null)}, '${esc(b.source)}', '${esc(meta)}', '2026-05-01T00:00:00Z', NOW()`);
    lines.push(`);`);
    lines.push('');
  }

  // Payments
  for (const p of SAMPLE_PAYMENTS) {
    lines.push(`INSERT INTO payments (id, booking_id, amount, currency, status, method, stripe_payment_intent_id, refund_amount, refund_reason, created_at, updated_at)`);
    lines.push(`VALUES (`);
    lines.push(`  '${esc(p.id)}', '${esc(p.bookingId)}', ${p.amount}, '${esc(p.currency)}', '${esc(p.status)}', '${esc(p.method)}',`);
    lines.push(`  ${nullable(p.stripePaymentIntentId || null)}, ${nullable((p as any).refundAmount ?? null)}, ${nullable((p as any).refundReason ?? null)}, '2026-05-01T00:00:00Z', NOW()`);
    lines.push(`);`);
    lines.push('');
  }

  // Booking activities
  const activityTypes = ['BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_ATTENDED'];
  let actCount = 0;
  for (const b of SAMPLE_BOOKINGS) {
    const count = b.status === 'ATTENDED' ? 4 : b.status === 'CANCELLED' ? 3 : b.status === 'REFUNDED' ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const at = activityTypes[i];
      const meta = JSON.stringify({ bookingStatus: b.status, ticketCount: b.ticketCount });
      lines.push(`INSERT INTO booking_activities (booking_id, user_id, event_type, metadata, timestamp)`);
      lines.push(`VALUES ('${esc(b.id)}', '${esc(b.userId)}', '${esc(at)}', '${esc(meta)}', '2026-05-01T00:00:00Z');`);
      actCount++;
    }
  }

  return `-- Custom migration: sample seed data\n\n${lines.join('\n')}`;
}

// ===== Main =====
async function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const migrations: [string, string, () => Promise<string> | string][] = [
    ['auth-service', '0001_sample_data.sql', generateAuthMigration],
    ['user-service', '0001_sample_data.sql', () => generateUserMigration()],
    ['vendor-service', '0001_sample_data.sql', () => generateVendorMigration()],
    ['event-service', '0001_sample_data.sql', () => generateEventMigration()],
    ['booking-service', '0001_sample_data.sql', () => generateBookingMigration()],
  ];

  for (const [service, filename, generator] of migrations) {
    const dir = path.join(repoRoot, 'apps', 'nestjs-services', service, 'src', 'database', 'migrations');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const sql = typeof generator === 'function' ?
      (generator.constructor.name === 'AsyncFunction' ? await (generator as any)() : generator()) :
      generator;

    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, sql);
    const lines = (sql as string).split('\n').length;
    console.log(`  Generated: ${service}/${filename} (${lines} lines, ${(Buffer.byteLength(sql as string) / 1024).toFixed(1)} KB)`);
  }

  console.log('\nAll migration files generated.');
}

main().catch(console.error);
