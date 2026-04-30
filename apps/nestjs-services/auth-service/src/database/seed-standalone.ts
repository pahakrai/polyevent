/**
 * Standalone seed script — uses drizzle-orm directly without NestJS DI.
 * Run: npx tsx src/database/seed-standalone.ts
 */
import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import { Pool } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const databaseUrl = process.env.AUTH_DATABASE_URL;

if (!databaseUrl) {
  console.error('AUTH_DATABASE_URL is not set');
  process.exit(1);
}

const dbUrl: string = databaseUrl;

// Use ws for local pg (neon serverless driver works with local pg via ws)
// Fallback to regular pg Pool for local development
async function main() {
  console.log('Connecting to:', dbUrl.replace(/\/\/.*@/, '//<credentials>@'));

  // For local PostgreSQL, use ws connection
  const pool = new Pool({ connectionString: dbUrl });
  pool.on('error', (err) => console.error('Pool error:', err));

  // Since we only need to insert, import pg directly for the connection
  const { Client } = require('pg');
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const SALT_ROUNDS = 10;

  const seedUsers = [
    {
      email: 'pahakadmin@polydom.io',
      password: 'Three1288',
      firstName: 'Pahak',
      lastName: 'Admin',
      role: 'ADMIN',
    },
    {
      email: 'admin@example.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
    {
      email: 'user@example.com',
      password: 'user123',
      firstName: 'Music',
      lastName: 'Lover',
      role: 'USER',
    },
    {
      email: 'vendor@example.com',
      password: 'vendor123',
      firstName: 'Venue',
      lastName: 'Owner',
      role: 'VENDOR',
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const seedUser of seedUsers) {
    // Check existing
    const check = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [seedUser.email],
    );

    if (check.rows.length > 0) {
      console.log(`  Skip: ${seedUser.email} (already exists)`);
      skipped++;
      continue;
    }

    const hashedPassword = await bcrypt.hash(seedUser.password, SALT_ROUNDS);

    await client.query(
      `INSERT INTO users (id, email, password, first_name, last_name, role, preferences, location, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now())`,
      [
        seedUser.email,
        hashedPassword,
        seedUser.firstName,
        seedUser.lastName,
        seedUser.role,
        JSON.stringify({
          musicalGenres: [],
          notificationSettings: { email: true, sms: false, push: true, marketingEmails: false },
          searchRadius: 50,
        }),
        JSON.stringify({
          city: 'Helsinki',
          country: 'Finland',
          latitude: 60.1699,
          longitude: 24.9384,
        }),
      ],
    );

    console.log(`  Created: ${seedUser.email} (${seedUser.role})`);
    created++;
  }

  await client.end();

  console.log(`\nAuth database seeded: ${created} created, ${skipped} skipped`);
  console.log('');
  console.log('Login credentials:');
  console.log('  Superadmin:  pahakadmin@polydom.io / Three1288');
  console.log('  Admin:       admin@example.com      / admin123');
  console.log('  User:        user@example.com       / user123');
  console.log('  Vendor:      vendor@example.com     / vendor123');
}

main().catch((error) => {
  console.error('Error seeding auth database:', error);
  process.exit(1);
});
