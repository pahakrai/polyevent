/**
 * Admin user migration — upserts the pahakadmin user.
 * Run: npx tsx src/database/migrate-admin.ts
 *
 * Uses raw pg so it works without NestJS DI.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

// Prefer local database for development; Neon is production-only
const databaseUrl = process.env.AUTH_DATABASE_URL;

if (!databaseUrl) {
  console.error('AUTH_DATABASE_URL is not set');
  process.exit(1);
}

async function main() {
  const { Client } = require('pg');

  const url = new URL(databaseUrl);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  const client = new Client({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`Connected to ${isLocal ? 'local' : 'remote'} database.`);

  const email = 'pahakadmin@polydom.io';
  const password = 'Three1288';
  const firstName = 'Pahak';
  const lastName = 'Admin';
  const role = 'ADMIN';

  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await client.query(
    'SELECT id FROM users WHERE email = $1',
    [email],
  );

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE users
       SET password = $1, first_name = $2, last_name = $3, role = $4, updated_at = now()
       WHERE email = $5`,
      [hashedPassword, firstName, lastName, role, email],
    );
    console.log(`Updated: ${email} (password reset, role: ${role})`);
  } else {
    await client.query(
      `INSERT INTO users (id, email, password, first_name, last_name, role, preferences, location, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, now())`,
      [
        email,
        hashedPassword,
        firstName,
        lastName,
        role,
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
    console.log(`Created: ${email} (role: ${role})`);
  }

  await client.end();
  console.log('Admin migration complete.');
}

main().catch((error) => {
  console.error('Admin migration failed:', error);
  process.exit(1);
});
