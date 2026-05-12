// Sample seed data is now handled by migration 0001_sample_data.sql.
// Run `drizzle-kit migrate` to apply.
// This file retains the upsertAdminUser utility used by migrate-admin.ts.

import { db } from './client';
import { users } from './schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const SALT_ROUNDS = 10;

const DEFAULT_PREFERENCES = {
  musicalGenres: [] as string[],
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
      .set({ password: hashedPassword, firstName, lastName })
      .where(eq(users.email, email));
    console.log(`  Updated: ${email}`);
  } else {
    await db.insert(users).values({
      id: `user-${Date.now()}`,
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
