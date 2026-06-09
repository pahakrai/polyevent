import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class PushChannel {
  private readonly logger = new Logger(PushChannel.name);

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('FCM_SERVER_KEY');
    if (key) {
      this.logger.log('Push channel configured (FCM)');
    } else {
      this.logger.warn('Push channel not configured — FCM_SERVER_KEY missing');
    }
  }

  async send(payload: PushPayload): Promise<boolean> {
    const key = this.config.get<string>('FCM_SERVER_KEY');
    if (!key) {
      this.logger.warn('Push channel unavailable — skipping send');
      return false;
    }

    // TODO: Integrate FCM SDK
    this.logger.log(`Push (stub) sent to user ${payload.userId}: ${payload.title}`);
    return true;
  }
}
