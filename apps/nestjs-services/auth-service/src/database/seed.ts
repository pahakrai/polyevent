import { db } from './client';
import { users } from './schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('Seeding auth database...');

  const SALT_ROUNDS = 10;

  // Define seed users — use upsert pattern (skip if email already exists)
  const seedUsers = [
    {
      email: 'pahakadmin@polydom.io',
      password: 'Three1288',
      firstName: 'Pahak',
      lastName: 'Admin',
      role: 'ADMIN' as const,
    },
    {
      email: 'admin@example.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN' as const,
    },
    {
      email: 'user@example.com',
      password: 'user123',
      firstName: 'Music',
      lastName: 'Lover',
      role: 'USER' as const,
    },
    {
      email: 'vendor@example.com',
      password: 'vendor123',
      firstName: 'Venue',
      lastName: 'Owner',
      role: 'VENDOR' as const,
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const seedUser of seedUsers) {
    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, seedUser.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Skip: ${seedUser.email} (already exists)`);
      skipped++;
      continue;
    }

    const hashedPassword = await bcrypt.hash(seedUser.password, SALT_ROUNDS);

    await db.insert(users).values({
      email: seedUser.email,
      password: hashedPassword,
      firstName: seedUser.firstName,
      lastName: seedUser.lastName,
      role: seedUser.role,
      preferences: {
        musicalGenres: [],
        notificationSettings: { email: true, sms: false, push: true, marketingEmails: false },
        searchRadius: 50,
      },
      location: {
        city: 'Helsinki',
        country: 'Finland',
        latitude: 60.1699,
        longitude: 24.9384,
      },
    });

    console.log(`  Created: ${seedUser.email} (${seedUser.role})`);
    created++;
  }

  console.log(`\nAuth database seeded: ${created} created, ${skipped} skipped`);
  console.log('');
  console.log('Login credentials:');
  console.log('  Superadmin:  pahakadmin@polydom.io / Three1288');
  console.log('  Admin:       admin@example.com      / admin123');
  console.log('  User:        user@example.com       / user123');
  console.log('  Vendor:      vendor@example.com     / vendor123');
}

seed().catch((error) => {
  console.error('Error seeding auth database:', error);
  process.exit(1);
});
