import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<string>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port || '587', 10),
        auth: { user, pass },
      });
      this.logger.log(`Email channel configured: ${host}:${port}`);
    } else {
      this.logger.warn('Email channel not configured — SMTP_HOST/SMTP_USER missing');
    }
  }

  async send(payload: EmailPayload): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email channel unavailable — skipping send');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM') || 'noreply@polydom.com',
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text || payload.html.replace(/<[^>]*>/g, ''),
      });
      this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
      return true;
    } catch (err) {
      this.logger.error(`Email failed to ${payload.to}: ${(err as Error).message}`);
      return false;
    }
  }
}
