import { Injectable, Logger } from '@nestjs/common';
import { db } from '../database/client';
import { adminAuditLogs } from '../database/schema';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  async log(
    adminId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    ipAddress?: string,
  ) {
    await db.insert(adminAuditLogs).values({
      adminId,
      action,
      resource,
      resourceId,
      details: details || {},
      ipAddress,
    });
    this.logger.log(`Audit: ${adminId} ${action} ${resource}${resourceId ? `/${resourceId}` : ''}`);
  }
}
