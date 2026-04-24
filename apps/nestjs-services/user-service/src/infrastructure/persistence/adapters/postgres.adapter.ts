import { Injectable } from '@nestjs/common';
import { DatabaseAdapter } from '@polydom/shared-types';
import { PostgresClient } from '@polydom/database-client';

/**
 * PostgreSQL adapter wrapping the shared PostgresClient.
 */
@Injectable()
export class PostgresAdapter implements DatabaseAdapter {
  private client: PostgresClient;

  constructor() {
    this.client = new PostgresClient();
  }

  initialize(databaseUrl: string, schema: Record<string, unknown>) {
    this.client.initialize(databaseUrl, schema);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  async beginTransaction(): Promise<void> {
    // Drizzle with Neon serverless does not support native transactions.
    // Use Neon SQL transaction blocks in production.
    console.warn('Transactions not fully implemented for Neon serverless');
  }

  async commitTransaction(): Promise<void> {
    console.warn('Transactions not fully implemented for Neon serverless');
  }

  async rollbackTransaction(): Promise<void> {
    console.warn('Transactions not fully implemented for Neon serverless');
  }

  async executeQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.client.executeQuery<T>(sql, params);
  }

  getClient(): any {
    return this.client.dbInstance;
  }
}