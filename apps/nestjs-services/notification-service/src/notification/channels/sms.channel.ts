import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsPayload {
  to: string;
  body: string;
}

@Injectable()
export class SmsChannel {
  private readonly logger = new Logger(SmsChannel.name);

  constructor(private readonly config: ConfigService) {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    if (sid) {
      this.logger.log('SMS channel configured (Twilio)');
    } else {
      this.logger.warn('SMS channel not configured — TWILIO_ACCOUNT_SID missing');
    }
  }

  async send(payload: SmsPayload): Promise<boolean> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    if (!sid) {
      this.logger.warn('SMS channel unavailable — skipping send');
      return false;
    }

    // TODO: Integrate Twilio SDK
    this.logger.log(`SMS (stub) sent to ${payload.to}: ${payload.body}`);
    return true;
  }
}
