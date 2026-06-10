import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { db } from '../database/client';
import { appConfig, NewAppConfig } from '../database/schema';

/**
 * All known configuration keys and their types.
 * Add new keys here when you need a runtime-configurable setting.
 */
export interface AppConfigKeys {
  'platform.fee.enabled': boolean;
  'platform.fee.percent': number;
  'platform.fee.flat_cents': number;
  'platform.fee.minimum_cents': number;
  'platform.fee.free_tier_max_events': number;
  'platform.fee.free_tier_max_revenue': number;
  'booking.vendor_lock_ttl_seconds': number;
  'booking.payouts_enabled': boolean;
  'booking.payout_schedule': string; // 'weekly' | 'biweekly' | 'monthly'
  'feature.ai_insights_enabled': boolean;
}

type ConfigKey = keyof AppConfigKeys;

const DEFAULT_VALUES: Record<ConfigKey, AppConfigKeys[ConfigKey]> = {
  'platform.fee.enabled': false,
  'platform.fee.percent': 0,
  'platform.fee.flat_cents': 0,
  'platform.fee.minimum_cents': 0,
  'platform.fee.free_tier_max_events': 0,
  'platform.fee.free_tier_max_revenue': 0,
  'booking.vendor_lock_ttl_seconds': 600,
  'booking.payouts_enabled': false,
  'booking.payout_schedule': 'weekly',
  'feature.ai_insights_enabled': true,
};

const ENV_MAP: Partial<Record<ConfigKey, string>> = {
  'platform.fee.enabled': 'PLATFORM_FEE_ENABLED',
  'platform.fee.percent': 'PLATFORM_FEE_PERCENTAGE',
  'platform.fee.flat_cents': 'PLATFORM_FEE_FLAT_CENTS',
  'platform.fee.minimum_cents': 'PLATFORM_FEE_MINIMUM_CENTS',
  'booking.vendor_lock_ttl_seconds': 'VENDOR_BOOKING_LOCK_TTL_SECONDS',
  'booking.payouts_enabled': 'PAYOUTS_ENABLED',
};

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private cache: Map<ConfigKey, AppConfigKeys[ConfigKey]> = new Map();

  constructor(private readonly nestConfig: NestConfigService) {}

  /**
   * Load all configs from DB into memory cache.
   * Falls back to env vars → hardcoded defaults.
   * Call once at startup.
   */
  async loadAll(): Promise<void> {
    try {
      const rows = await db.select().from(appConfig);
      for (const row of rows) {
        const key = row.key as ConfigKey;
        if (key in DEFAULT_VALUES) {
          this.cache.set(key, row.value as AppConfigKeys[ConfigKey]);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to load config from DB: ${(err as Error).message}`);
    }

    // Fill missing keys from env → defaults
    for (const key of Object.keys(DEFAULT_VALUES) as ConfigKey[]) {
      if (!this.cache.has(key)) {
        const envKey = ENV_MAP[key];
        if (envKey) {
          const envVal = this.nestConfig.get<string>(envKey);
          if (envVal !== undefined) {
            this.cache.set(key, this.coerce(envVal, key));
            continue;
          }
        }
        this.cache.set(key, DEFAULT_VALUES[key]);
      }
    }

    this.logger.log(`Config loaded: ${this.cache.size} keys`);
  }

  /** Get a typed config value. */
  get<K extends ConfigKey>(key: K): AppConfigKeys[K] {
    if (this.cache.has(key)) {
      return this.cache.get(key) as AppConfigKeys[K];
    }
    return DEFAULT_VALUES[key] as AppConfigKeys[K];
  }

  /** Get boolean config. */
  getBool(key: ConfigKey): boolean {
    return Boolean(this.get(key as any));
  }

  /** Get number config. */
  getNumber(key: ConfigKey): number {
    return Number(this.get(key as any));
  }

  /** Get string config. */
  getString(key: ConfigKey): string {
    return String(this.get(key as any));
  }

  /**
   * Set a config value — updates DB + cache immediately.
   * Returns the new value.
   */
  async set<K extends ConfigKey>(
    key: K,
    value: AppConfigKeys[K],
    updatedBy?: string,
  ): Promise<AppConfigKeys[K]> {
    // Upsert in DB
    const existing = await db
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(appConfig)
        .set({
          value: value as any,
          updatedBy: updatedBy || undefined,
        })
        .where(eq(appConfig.key, key));
    } else {
      await db.insert(appConfig).values({
        key,
        value: value as any,
        description: `Auto-created for ${key}`,
        updatedBy: updatedBy || undefined,
      } as NewAppConfig);
    }

    // Update cache
    this.cache.set(key, value);
    this.logger.log(`Config ${key} = ${JSON.stringify(value)}`);

    return value;
  }

  /** List all configs with their current values (for admin UI). */
  async listAll(): Promise<Array<{ key: ConfigKey; value: any; description: string }>> {
    const dbRows = await db.select().from(appConfig);
    const dbMap = new Map<string, (typeof dbRows)[number]>(dbRows.map((r) => [r.key, r]));

    return (Object.keys(DEFAULT_VALUES) as ConfigKey[]).map((key) => ({
      key,
      value: this.get(key),
      description: dbMap.get(key)?.description || '',
    }));
  }

  /** Coerce an env string to the correct type based on the default value. */
  private coerce(raw: string, key: ConfigKey): any {
    const def = DEFAULT_VALUES[key];
    if (typeof def === 'boolean') return raw === 'true';
    if (typeof def === 'number') return Number(raw);
    return raw;
  }
}
