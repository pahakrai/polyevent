import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import type { Redis as RedisType, RedisOptions } from 'ioredis';

export interface RedisClientConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

export const REDIS_CLIENT_CONFIG = 'REDIS_CLIENT_CONFIG';

/**
 * Redis client using ioredis for connection management and operations.
 */
@Injectable()
export class RedisClient {
  private readonly logger = new Logger(RedisClient.name);
  private client: RedisType | null = null;
  private Redis: any;

  constructor(
    @Optional() @Inject(REDIS_CLIENT_CONFIG) private readonly config?: RedisClientConfig,
  ) {}

  async connect(): Promise<void> {
    try {
      this.Redis = require('ioredis').default || require('ioredis');

      let redisOptions: RedisOptions;

      if (this.config?.url) {
        redisOptions = { lazyConnect: true };
        this.client = new this.Redis(this.config.url, redisOptions);
      } else if (this.config?.host) {
        redisOptions = {
          host: this.config.host,
          port: this.config.port || 6379,
          password: this.config.password,
          db: this.config.db || 0,
        };
        this.client = new this.Redis(redisOptions);
      } else {
        throw new Error(
          'Redis configuration not provided. Set REDIS_CLIENT_CONFIG with url or host/port.',
        );
      }

      await this.client.connect();
      this.logger.log('Connected to Redis');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.logger.log('Disconnected from Redis');
    }
  }

  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) throw new Error('Redis not connected');
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client) throw new Error('Redis not connected');
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<number> {
    if (!this.client) throw new Error('Redis not connected');
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    if (!this.client) throw new Error('Redis not connected');
    return this.client.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.client) throw new Error('Redis not connected');
    return this.client.expire(key, seconds);
  }

  getClient(): any {
    return this.client;
  }
}
