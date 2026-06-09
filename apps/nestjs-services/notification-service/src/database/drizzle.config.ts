import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();
const rootEnvPath = path.resolve(__dirname, '../../../../../.env');
dotenv.config({ path: rootEnvPath });

const databaseUrl = process.env.USE_NEON === 'true'
  ? process.env.NEON_NOTIFICATION_DATABASE_URL || process.env.NOTIFICATION_DATABASE_URL || ''
  : process.env.NOTIFICATION_DATABASE_URL || '';

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  verbose: true,
  strict: true,
});
