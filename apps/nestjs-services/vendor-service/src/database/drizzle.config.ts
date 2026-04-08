import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from local .env first, then root .env (root overrides)
dotenv.config(); // Load from current directory
const rootEnvPath = path.resolve(__dirname, '../../../../../.env');
dotenv.config({ path: rootEnvPath }); // Override with root .env

// Use Neon database URL if USE_NEON is set, otherwise use regular URL
const databaseUrl = process.env.USE_NEON
  ? process.env.NEON_VENDOR_DATABASE_URL || process.env.VENDOR_DATABASE_URL || ''
  : process.env.VENDOR_DATABASE_URL || '';

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});