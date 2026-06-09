import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { TemplateService } from './template.service';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { PushChannel } from './channels/push.channel';

@Module({
  imports: [ConfigModule],
  controllers: [NotificationController],
  providers: [NotificationService, TemplateService, EmailChannel, SmsChannel, PushChannel],
  exports: [NotificationService],
})
export class NotificationModule {}
