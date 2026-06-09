import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { db } from '../database/client';
import { systemConfig } from '../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private url(service: string): string {
    return this.config.get<string>(`${service.toUpperCase()}_SERVICE_URL`) || `http://${service}-service:3000`;
  }

  async getDashboard(period: string = 'month') {
    // Aggregate counts available from existing endpoints
    try {
      const [vendorRes, eventRes] = await Promise.allSettled([
        firstValueFrom(this.http.get(`${this.url('vendor')}/vendors`)),
        firstValueFrom(this.http.get(`${this.url('event')}/events`)),
      ]);

      const vendors = vendorRes.status === 'fulfilled' ? vendorRes.value.data : null;
      const events = eventRes.status === 'fulfilled' ? eventRes.value.data : null;

      // Read system config counts from admin_db as a lightweight fallback
      const adminDbStats = {
        featureFlags: (await db.select().from(systemConfig)).length,
      };

      return {
        period,
        vendors: Array.isArray(vendors) ? { total: vendors.length } : null,
        events: Array.isArray(events) ? { total: events.length } : null,
        admin: adminDbStats,
        note: 'Full dashboard aggregation requires stats endpoints on upstream services',
      };
    } catch (err) {
      this.logger.error(`Dashboard aggregation failed: ${(err as Error).message}`);
      return { period, error: 'Failed to aggregate dashboard data' };
    }
  }

  async getReports(type: string, period: string = 'month') {
    return {
      type,
      period,
      data: null,
      note: `Reports not available — ${type} service does not expose a /reports endpoint yet`,
    };
  }

  async setMaintenanceMode(enabled: boolean) {
    const [existing] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'maintenance_mode'))
      .limit(1);

    if (existing) {
      await db
        .update(systemConfig)
        .set({ value: enabled })
        .where(eq(systemConfig.key, 'maintenance_mode'));
    } else {
      await db.insert(systemConfig).values({
        key: 'maintenance_mode',
        value: enabled,
        description: 'Maintenance mode flag',
      });
    }

    this.logger.log(`Maintenance mode: ${enabled ? 'ON' : 'OFF'}`);
    return { maintenanceMode: enabled };
  }
}
