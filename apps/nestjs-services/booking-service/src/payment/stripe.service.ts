import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  readonly stripe: Stripe;
  readonly webhookSecret: string;

  constructor(configService: ConfigService) {
    const secretKey = configService.get<string>('STRIPE_SECRET_KEY') || 'sk_test_placeholder';
    this.webhookSecret = configService.get<string>('STRIPE_WEBHOOK_SECRET') || 'whsec_placeholder';
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-03-31.basil' as any,
    });
    this.logger.log('Stripe service initialized');
  }

  /** Create a PaymentIntent for the given amount and currency. */
  async createPaymentIntent(
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      metadata,
      payment_method_types: ['card', 'alipay', 'wechat_pay'],
    });
  }

  /** Verify a Stripe webhook signature. */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  /** Retrieve a PaymentIntent by ID. */
  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(id);
  }
}
