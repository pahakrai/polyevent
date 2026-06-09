import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../database/client';
import { featureFlags } from '../database/schema';
import { AuditService } from './audit.service';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(private readonly audit: AuditService) {}

  async list() {
    return db.select().from(featureFlags);
  }

  async get(key: string) {
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
    return flag || null;
  }

  async isEnabled(key: string): Promise<boolean> {
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
    return flag?.enabled ?? false;
  }

  async create(dto: { key: string; name: string; description?: string; enabled?: boolean }, adminId: string) {
    const [flag] = await db.insert(featureFlags).values(dto).returning();
    await this.audit.log(adminId, 'CREATE', 'feature_flag', flag.id, { key: dto.key });
    return flag;
  }

  async update(key: string, dto: { enabled?: boolean; description?: string; conditions?: any }, adminId: string) {
    const [existing] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
    if (!existing) throw new NotFoundException(`Flag '${key}' not found`);

    await db.update(featureFlags).set({ ...dto, updatedBy: adminId }).where(eq(featureFlags.key, key));
    await this.audit.log(adminId, 'UPDATE', 'feature_flag', existing.id, dto);

    const [updated] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
    return updated;
  }

  async delete(key: string, adminId: string) {
    const [existing] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
    if (!existing) throw new NotFoundException(`Flag '${key}' not found`);

    await db.delete(featureFlags).where(eq(featureFlags.key, key));
    await this.audit.log(adminId, 'DELETE', 'feature_flag', existing.id, { key });
    this.logger.log(`Deleted flag: ${key}`);
  }
}
