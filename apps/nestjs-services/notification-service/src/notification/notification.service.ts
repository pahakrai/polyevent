import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../database/client';
import { notifications, notificationTemplates, notificationPreferences } from '../database/schema';
import { TemplateService } from './template.service';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { PushChannel } from './channels/push.channel';
import { SendNotificationDto } from './dto/send-notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailChannel: EmailChannel,
    private readonly smsChannel: SmsChannel,
    private readonly pushChannel: PushChannel,
    private readonly templateService: TemplateService,
    private readonly config: ConfigService,
  ) {}

  async send(dto: SendNotificationDto) {
    // Check preferences
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, dto.userId))
      .limit(1);

    let subject = dto.subject || '';
    let content = { ...dto.content };

    // Resolve template if specified
    if (dto.templateId) {
      const [template] = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.name, dto.templateId))
        .limit(1);

      if (!template) {
        throw new NotFoundException(`Template '${dto.templateId}' not found`);
      }

      if (!template.isActive) {
        this.logger.warn(`Template '${dto.templateId}' is inactive`);
      }

      const rendered = this.templateService.renderTemplate(
        template.subject,
        template.body,
        dto.content,
      );
      subject = subject || rendered.subject;
      content = { body: rendered.body, ...dto.content };
    }

    // Respect quiet hours
    if (prefs && prefs.quietHoursStart && prefs.quietHoursEnd) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startParts = prefs.quietHoursStart.split(':').map(Number);
      const endParts = prefs.quietHoursEnd.split(':').map(Number);
      const startMinutes = startParts[0] * 60 + startParts[1];
      const endMinutes = endParts[0] * 60 + endParts[1];

      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        this.logger.log(`Quiet hours active — deferring notification for ${dto.userId}`);
        // Store as pending for later delivery
        await db.insert(notifications).values({
          userId: dto.userId,
          channel: dto.channel,
          templateId: dto.templateId,
          subject,
          content,
          status: 'PENDING',
          metadata: dto.metadata || {},
        });
        return { status: 'deferred', reason: 'quiet_hours' };
      }
    }

    // Deliver via channel
    let success = false;
    let errorMessage: string | undefined;

    switch (dto.channel) {
      case 'EMAIL':
        success = await this.emailChannel.send({
          to: content.email || dto.userId,
          subject,
          html: content.body || JSON.stringify(content),
          text: content.text,
        });
        break;
      case 'SMS':
        success = await this.smsChannel.send({
          to: content.phone || dto.userId,
          body: content.body || JSON.stringify(content),
        });
        break;
      case 'PUSH':
        success = await this.pushChannel.send({
          userId: dto.userId,
          title: subject,
          body: content.body || '',
          data: content.data,
        });
        break;
      case 'IN_APP':
        // In-app delivered via WebSocket/broadcast — store for retrieval
        success = true;
        break;
    }

    // Record delivery
    await db.insert(notifications).values({
      userId: dto.userId,
      channel: dto.channel,
      templateId: dto.templateId,
      subject,
      content,
      status: success ? 'SENT' : 'FAILED',
      metadata: dto.metadata || {},
      errorMessage,
      sentAt: success ? new Date() : undefined,
    });

    return { status: success ? 'sent' : 'failed' };
  }

  async findByUser(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const results = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return { data: results, page, limit };
  }

  async findOne(id: string) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    return notification;
  }

  async getPreferences(userId: string) {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    return prefs || { userId, emailEnabled: true, smsEnabled: false, pushEnabled: true, inAppEnabled: true, marketingEmails: false };
  }

  async updatePreferences(userId: string, dto: any) {
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(notificationPreferences)
        .set(dto)
        .where(eq(notificationPreferences.userId, userId));
    } else {
      await db.insert(notificationPreferences).values({ userId, ...dto });
    }

    return this.getPreferences(userId);
  }

  async listTemplates() {
    return db.select().from(notificationTemplates);
  }

  async createTemplate(dto: any) {
    const [template] = await db.insert(notificationTemplates).values(dto).returning();
    return template;
  }

  async updateTemplate(id: string, dto: any) {
    const [existing] = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException(`Template ${id} not found`);

    await db.update(notificationTemplates).set(dto).where(eq(notificationTemplates.id, id));
    const [updated] = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .limit(1);
    return updated;
  }
}
