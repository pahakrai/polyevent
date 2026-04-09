import { Injectable } from '@nestjs/common';
import { DatabaseAdapter } from '@polydom/shared-types';

/**
 * Redis adapter (stub implementation)
 */
@Injectable()
export class RedisAdapter implements DatabaseAdapter {
  async connect(): Promise<void> {
    console.log('Redis adapter connect - stub');
  }

  async disconnect(): Promise<void> {
    console.log('Redis adapter disconnect - stub');
  }

  isConnected(): boolean {
    return false;
  }

  async beginTransaction(): Promise<void> {
    throw new Error('Transactions not supported by Redis in this stub');
  }

  async commitTransaction(): Promise<void> {
    throw new Error('Transactions not supported by Redis in this stub');
  }

  async rollbackTransaction(): Promise<void> {
    throw new Error('Transactions not supported by Redis in this stub');
  }

  async executeQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
    throw new Error('Raw query not supported by Redis adapter');
  }

  getClient(): any {
    throw new Error('Redis client not implemented');
  }
}