import { PostgresClient } from '@polydom/database-client';
import * as dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

const databaseUrl = process.env.EVENT_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('EVENT_DATABASE_URL environment variable is not set');
}

const postgresClient = new PostgresClient();
const db = postgresClient.initialize(databaseUrl, schema);

export { postgresClient, db };
export { schema };