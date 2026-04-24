import { Injectable } from '@nestjs/common';
import { DatabaseAdapter } from '@polydom/shared-types';
import { RedisClient } from '@polydom/database-client';

/**
 * Redis adapter wrapping the shared RedisClient.
 */
@Injectable()
export class RedisAdapter implements DatabaseAdapter {
  private client: RedisClient;

  constructor() {
    this.client = new RedisClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
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
    throw new Error('Transactions not supported by Redis');
  }

  async commitTransaction(): Promise<void> {
    throw new Error('Transactions not supported by Redis');
  }

  async rollbackTransaction(): Promise<void> {
    throw new Error('Transactions not supported by Redis');
  }

  async executeQuery<T = any>(_sql: string, _params?: any[]): Promise<T[]> {
    throw new Error('Raw SQL queries not supported by Redis adapter. Use get/set/del instead.');
  }

  getClient(): RedisClient {
    return this.client;
  }
}