import { Injectable, Logger, Inject, Optional } from '@nestjs/common';

export interface PostgresClientConfig {
  databaseUrl: string;
}

export const POSTGRES_CLIENT_CONFIG = 'POSTGRES_CLIENT_CONFIG';

/**
 * PostgreSQL client using Drizzle ORM with Neon serverless driver.
 * Provides a generic drizzle instance that services configure with their own schema.
 */
@Injectable()
export class PostgresClient {
  private readonly logger = new Logger(PostgresClient.name);
  private _client: any;
  private _db: any;

  constructor(
    @Optional() @Inject(POSTGRES_CLIENT_CONFIG) private readonly config?: PostgresClientConfig,
  ) {}

  /**
   * Initialize the client with a database URL and optional schema.
   * Returns a drizzle instance bound to the schema.
   */
  initialize<TSchema extends Record<string, unknown>>(
    databaseUrl: string,
    schema: TSchema,
  ) {
    const { neon } = require('@neondatabase/serverless');
    const { drizzle } = require('drizzle-orm/neon-serverless');

    this._client = neon(databaseUrl);
    this._db = drizzle(this._client, { schema });

    this.logger.log('PostgreSQL client initialized');
    return this._db;
  }

  /**
   * Get the underlying drizzle database instance.
   */
  get dbInstance(): any {
    if (!this._db) {
      throw new Error(
        'PostgresClient not initialized. Call initialize() with a database URL and schema first.',
      );
    }
    return this._db;
  }

  /**
   * Get the raw Neon client for direct SQL execution.
   */
  get rawClient(): any {
    if (!this._client) {
      throw new Error(
        'PostgresClient not initialized. Call initialize() first.',
      );
    }
    return this._client;
  }

  async connect(): Promise<void> {
    this.logger.log('PostgreSQL client connected (Neon serverless)');
  }

  async disconnect(): Promise<void> {
    this.logger.log('PostgreSQL client disconnected');
  }

  isConnected(): boolean {
    return this._client !== undefined && this._db !== undefined;
  }

  async executeQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this._client) {
      throw new Error('PostgresClient not initialized');
    }
    const result = await this._client(sql, params);
    return result as T[];
  }
}
