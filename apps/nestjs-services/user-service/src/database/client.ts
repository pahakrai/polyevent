import { PostgresClient } from '@polydom/database-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as schema from './schema';

dotenv.config();
const rootEnvPath = path.resolve(__dirname, '../../../../../.env');
dotenv.config({ path: rootEnvPath });

const databaseUrl = process.env.USE_NEON === 'true'
  ? process.env.NEON_USER_DATABASE_URL || process.env.USER_DATABASE_URL || ''
  : process.env.USER_DATABASE_URL || '';

if (!databaseUrl) {
  throw new Error('USER_DATABASE_URL environment variable is not set');
}

const postgresClient = new PostgresClient();
const db = postgresClient.initialize(databaseUrl, schema);

export { postgresClient, db };
export { schema };