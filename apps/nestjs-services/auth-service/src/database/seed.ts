import { db } from './client';
import { users, userActivities } from './schema';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';

dotenv.config();

async function seed() {
  console.log('Seeding auth database...');

  // Clear existing data
  await db.delete(userActivities);
  await db.delete(users);

  // Create test users
  const [adminUser] = await db.insert(users).values({
    email: 'admin@example.com',
    password: '$2b$10$YourHashedPasswordHere', // In real app, use bcrypt
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
  }).returning();

  const [regularUser] = await db.insert(users).values({
    email: 'user@example.com',
    password: '$2b$10$YourHashedPasswordHere',
    firstName: 'Regular',
    lastName: 'User',
    role: 'USER',
  }).returning();

  const [vendorUser] = await db.insert(users).values({
    email: 'vendor@example.com',
    password: '$2b$10$YourHashedPasswordHere',
    firstName: 'Vendor',
    lastName: 'Owner',
    role: 'VENDOR',
  }).returning();

  // Create login activities
  await db.insert(userActivities).values([
    {
      userId: adminUser.id,
      eventType: 'LOGIN',
      metadata: { ip: '127.0.0.1', userAgent: 'Seed Script' },
    },
    {
      userId: regularUser.id,
      eventType: 'LOGIN',
      metadata: { ip: '127.0.0.1', userAgent: 'Seed Script' },
    },
    {
      userId: vendorUser.id,
      eventType: 'LOGIN',
      metadata: { ip: '127.0.0.1', userAgent: 'Seed Script' },
    },
  ]);

  console.log('Auth database seeded successfully!');
  console.log(`Created users: admin@example.com, user@example.com, vendor@example.com`);
}

seed().catch((error) => {
  console.error('Error seeding auth database:', error);
  process.exit(1);
});