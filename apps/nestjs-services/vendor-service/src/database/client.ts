import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

export class DatabaseClient {
  private client;
  private db;

  constructor() {
    const databaseUrl = process.env.VENDOR_DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('VENDOR_DATABASE_URL environment variable is not set');
    }

    this.client = neon(databaseUrl);
    this.db = drizzle(this.client, { schema });
  }

  get dbInstance() {
    return this.db;
  }

  async connect(): Promise<void> {
    // Connection is handled by Neon client
    console.log('Connected to Vendor database');
  }

  async disconnect(): Promise<void> {
    // Neon serverless client doesn't need explicit disconnect
    console.log('Disconnected from Vendor database');
  }

  // Convenience getters for tables
  get vendors() {
    return this.db.select().from(schema.vendors);
  }

  get venues() {
    return this.db.select().from(schema.venues);
  }
}

// Singleton instance
export const dbClient = new DatabaseClient();
export const db = dbClient.dbInstance;