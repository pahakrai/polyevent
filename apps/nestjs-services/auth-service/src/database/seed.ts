import { db } from './client';
import { users } from './schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const SALT_ROUNDS = 10;

const SEED_USERS = [
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

const DEFAULT_PREFERENCES = {
  musicalGenres: [],
  notificationSettings: { email: true, sms: false, push: true, marketingEmails: false },
  searchRadius: 50,
};

const DEFAULT_LOCATION = {
  city: 'Helsinki',
  country: 'Finland',
  latitude: 60.1699,
  longitude: 24.9384,
};

export async function upsertAdminUser(email: string, password: string, firstName: string, lastName: string) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ password: hashedPassword, firstName, lastName, role: 'ADMIN' })
      .where(eq(users.email, email));
    console.log(`  Updated: ${email} (password reset, role: ADMIN)`);
  } else {
    await db.insert(users).values({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'ADMIN',
      preferences: DEFAULT_PREFERENCES,
      location: DEFAULT_LOCATION,
    });
    console.log(`  Created: ${email} (ADMIN)`);
  }
}

async function seed() {
  console.log('Seeding auth database...');

  let created = 0;
  let skipped = 0;

  for (const seedUser of SEED_USERS) {
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
      preferences: DEFAULT_PREFERENCES,
      location: DEFAULT_LOCATION,
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

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seed().catch((error) => {
    console.error('Error seeding auth database:', error);
    process.exit(1);
  });
}
