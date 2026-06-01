import { Controller, Post, Req, Headers, RawBodyRequest } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Request } from 'express';
import { eq } from 'drizzle-orm';
import { StripeService } from './stripe.service';
import { PaymentService } from './payment.service';
import { db } from '../database/client';
import { payments } from '../database/schema';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentService: PaymentService,
  ) {}

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      this.logger.warn('No raw body — webhook verification skipped');
      return { received: true };
    }

    let event: any;
    try {
      event = this.stripeService.constructWebhookEvent(req.rawBody, signature);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${(err as Error).message}`);
      return { received: false, error: 'signature_verification_failed' };
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const piId = paymentIntent.id as string;

        const [payment] = await db
          .select()
          .from(payments)
          .where(eq(payments.stripePaymentIntentId, piId))
          .limit(1);

        if (payment) {
          await this.paymentService.confirmBooking(payment.bookingId, piId);
          this.logger.log(`Booking ${payment.bookingId} confirmed via webhook`);
        } else {
          this.logger.warn(`No payment found for PaymentIntent ${piId}`);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        this.logger.warn(`PaymentIntent ${event.data.object.id} failed`);
        break;
      }
    }

    return { received: true };
  }
}
