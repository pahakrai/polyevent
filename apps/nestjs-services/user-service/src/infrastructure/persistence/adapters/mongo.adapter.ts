import { Injectable } from '@nestjs/common';
import { DatabaseAdapter } from '@polydom/shared-types';

/**
 * MongoDB adapter (stub implementation)
 */
@Injectable()
export class MongoAdapter implements DatabaseAdapter {
  async connect(): Promise<void> {
    console.log('MongoDB adapter connect - stub');
  }

  async disconnect(): Promise<void> {
    console.log('MongoDB adapter disconnect - stub');
  }

  isConnected(): boolean {
    return false;
  }

  async beginTransaction(): Promise<void> {
    throw new Error('Transactions not supported by MongoDB in this stub');
  }

  async commitTransaction(): Promise<void> {
    throw new Error('Transactions not supported by MongoDB in this stub');
  }

  async rollbackTransaction(): Promise<void> {
    throw new Error('Transactions not supported by MongoDB in this stub');
  }

  async executeQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
    throw new Error('Raw query not supported by MongoDB adapter');
  }

  getClient(): any {
    throw new Error('MongoDB client not implemented');
  }
}