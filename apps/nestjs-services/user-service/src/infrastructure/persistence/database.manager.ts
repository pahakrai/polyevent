import { Injectable } from '@nestjs/common';
import { DatabaseAdapter } from '@polydom/shared-types';
import { PostgresAdapter } from './adapters/postgres.adapter';
import { MongoAdapter } from './adapters/mongo.adapter';
import { RedisAdapter } from './adapters/redis.adapter';

export enum DatabaseType {
  POSTGRES = 'postgres',
  MONGO = 'mongo',
  REDIS = 'redis',
}

/**
 * Manages multiple database adapters
 */
@Injectable()
export class DatabaseManager {
  private adapters = new Map<DatabaseType, DatabaseAdapter>();

  constructor(
    private readonly postgresAdapter: PostgresAdapter,
    private readonly mongoAdapter: MongoAdapter,
    private readonly redisAdapter: RedisAdapter,
  ) {
    this.adapters.set(DatabaseType.POSTGRES, postgresAdapter);
    this.adapters.set(DatabaseType.MONGO, mongoAdapter);
    this.adapters.set(DatabaseType.REDIS, redisAdapter);
  }

  /**
   * Get adapter by database type
   */
  getAdapter(type: DatabaseType): DatabaseAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`Database adapter not found for type: ${type}`);
    }
    return adapter;
  }

  /**
   * Connect all adapters
   */
  async connectAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.connect();
    }
  }

  /**
   * Disconnect all adapters
   */
  async disconnectAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
  }

  /**
   * Check if a specific adapter is connected
   */
  isConnected(type: DatabaseType): boolean {
    const adapter = this.adapters.get(type);
    return adapter ? adapter.isConnected() : false;
  }
}