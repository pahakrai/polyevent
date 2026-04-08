import { db } from './client';
import { users, userActivities } from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('Seeding user database...');

  // Clear existing data
  await db.delete(userActivities);
  await db.delete(users);

  // Create user profiles (matching auth service users)
  const [adminUser] = await db.insert(users).values({
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    preferences: { theme: 'dark', notifications: true },
  }).returning();

  const [regularUser] = await db.insert(users).values({
    email: 'user@example.com',
    firstName: 'Regular',
    lastName: 'User',
    role: 'USER',
    preferences: { theme: 'light', notifications: true },
  }).returning();

  const [vendorUser] = await db.insert(users).values({
    email: 'vendor@example.com',
    firstName: 'Vendor',
    lastName: 'Owner',
    role: 'VENDOR',
    preferences: { theme: 'auto', notifications: true },
  }).returning();

  // Create user activities
  await db.insert(userActivities).values([
    {
      userId: adminUser.id,
      eventType: 'VIEW_EVENT',
      metadata: { eventId: 'event-1', category: 'CONCERT' },
    },
    {
      userId: regularUser.id,
      eventType: 'SEARCH',
      metadata: { query: 'jazz night', location: 'NYC' },
    },
    {
      userId: vendorUser.id,
      eventType: 'BOOKING_CREATED',
      metadata: { bookingId: 'booking-1', eventId: 'event-2' },
    },
  ]);

  console.log('User database seeded successfully!');
  console.log(`Created user profiles: admin@example.com, user@example.com, vendor@example.com`);
}

seed().catch((error) => {
  console.error('Error seeding user database:', error);
  process.exit(1);
});