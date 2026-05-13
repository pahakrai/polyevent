import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { InvestigationSession } from './investigation.service';

const SESSION_PREFIX = 'investigation:';
const CANCEL_SUFFIX = ':cancelled';
const DEFAULT_TTL = 86_400; // 24h

@Injectable()
export class SessionStore implements OnModuleDestroy {
  private readonly logger = new Logger(SessionStore.name);
  private readonly redis: Redis;

  constructor(configService: ConfigService) {
    const url =
      configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(url);
    this.logger.log(`SessionStore connected to Redis`);
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }

  // ── Session CRUD ──────────────────────────────────────────────────

  async save(session: InvestigationSession): Promise<void> {
    const key = SESSION_PREFIX + session.id;
    await this.redis.set(key, JSON.stringify(session), 'EX', DEFAULT_TTL);
  }

  async get(sessionId: string): Promise<InvestigationSession | null> {
    const raw = await this.redis.get(SESSION_PREFIX + sessionId);
    if (!raw) return null;
    return JSON.parse(raw) as InvestigationSession;
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(SESSION_PREFIX + sessionId);
    await this.redis.del(SESSION_PREFIX + sessionId + CANCEL_SUFFIX);
  }

  // ── Cancel flag ───────────────────────────────────────────────────

  async setCancelled(sessionId: string): Promise<void> {
    await this.redis.set(
      SESSION_PREFIX + sessionId + CANCEL_SUFFIX,
      '1',
      'EX',
      DEFAULT_TTL,
    );
  }

  async isCancelled(sessionId: string): Promise<boolean> {
    const val = await this.redis.get(SESSION_PREFIX + sessionId + CANCEL_SUFFIX);
    return val === '1';
  }

  async clearCancelled(sessionId: string): Promise<void> {
    await this.redis.del(SESSION_PREFIX + sessionId + CANCEL_SUFFIX);
  }

  // ── Vendor concurrency (max 3 active jobs per vendor) ──────────────

  /**
   * Try to acquire a concurrency slot for a vendor.
   * Returns true if the slot was acquired, false if the vendor is at capacity.
   */
  async acquireVendorSlot(vendorId: string): Promise<boolean> {
    const key = `vendor:concurrency:${vendorId}`;
    // Lua script: increment and set TTL atomically
    const script = `
      local count = redis.call('INCR', KEYS[1])
      redis.call('EXPIRE', KEYS[1], 600)
      return count
    `;
    const count = await this.redis.eval(script, 1, key);
    if ((count as number) > 3) {
      await this.redis.decr(key);
      return false;
    }
    return true;
  }

  /**
   * Release a concurrency slot for a vendor.
   */
  async releaseVendorSlot(vendorId: string): Promise<void> {
    const key = `vendor:concurrency:${vendorId}`;
    await this.redis.decr(key);
  }
}
