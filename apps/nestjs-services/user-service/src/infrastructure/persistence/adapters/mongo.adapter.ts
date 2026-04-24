import { Injectable } from '@nestjs/common';
import { DatabaseAdapter } from '@polydom/shared-types';
import { MongoDBClient } from '@polydom/database-client';

/**
 * MongoDB adapter wrapping the shared MongoDBClient.
 */
@Injectable()
export class MongoAdapter implements DatabaseAdapter {
  private client: MongoDBClient;

  constructor() {
    this.client = new MongoDBClient();
  }

  async connect(): Promise<void> {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    await this.client.connect(uri);
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  async beginTransaction(): Promise<void> {
    // MongoDB supports transactions on replica sets.
    // Full implementation requires session management.
    console.warn('MongoDB transactions require replica set configuration');
  }

  async commitTransaction(): Promise<void> {
    console.warn('MongoDB transactions require replica set configuration');
  }

  async rollbackTransaction(): Promise<void> {
    console.warn('MongoDB transactions require replica set configuration');
  }

  async executeQuery<T = any>(_sql: string, _params?: any[]): Promise<T[]> {
    throw new Error('Raw SQL queries not supported by MongoDB adapter. Use find() / insert() instead.');
  }

  getClient(): MongoDBClient {
    return this.client;
  }
}