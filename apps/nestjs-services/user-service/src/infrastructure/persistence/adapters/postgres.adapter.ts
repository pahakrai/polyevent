import { Injectable } from '@nestjs/common';
import { DatabaseAdapter } from '@polydom/shared-types';
import { dbClient } from '../../../../database/client';

/**
 * PostgreSQL adapter using Drizzle ORM
 */
@Injectable()
export class PostgresAdapter implements DatabaseAdapter {
  constructor() {}

  async connect(): Promise<void> {
    await dbClient.connect();
  }

  async disconnect(): Promise<void> {
    await dbClient.disconnect();
  }

  isConnected(): boolean {
    // Since Neon serverless doesn't have persistent connection,
    // we assume connected if client is initialized
    return true;
  }

  async beginTransaction(): Promise<void> {
    // Drizzle with Neon serverless may not support transactions directly
    // For now, we'll implement a placeholder
    // In production, you'd use the appropriate transaction API
    console.warn('Transactions not fully implemented for Neon serverless');
  }

  async commitTransaction(): Promise<void> {
    console.warn('Transactions not fully implemented for Neon serverless');
  }

  async rollbackTransaction(): Promise<void> {
    console.warn('Transactions not fully implemented for Neon serverless');
  }

  async executeQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
    // For raw queries, we need access to the underlying client
    // Neon client supports raw queries
    const result = await dbClient.dbInstance.execute(sql, params);
    return result as T[];
  }

  getClient(): any {
    return dbClient.dbInstance;
  }
}