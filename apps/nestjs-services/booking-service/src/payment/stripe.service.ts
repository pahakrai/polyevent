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

  /**
   * Refund a PaymentIntent/Charge.
   * `amountCents` is the amount to refund in cents (defaults to full refund).
   * `idempotencyKey` prevents duplicate refunds on retries.
   */
  async refundPaymentIntent(
    paymentIntentId: string,
    amountCents?: number,
    idempotencyKey?: string,
  ): Promise<Stripe.Refund> {
    return this.stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        ...(amountCents !== undefined ? { amount: amountCents } : {}),
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
  }

  /**
   * Transfer the vendor's net amount to their Stripe connected account.
   * Uses the booking id as the idempotency key so a retried payout never double-pays.
   */
  async createTransfer(
    amountCents: number,
    currency: string,
    destinationAccountId: string,
    idempotencyKey: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Transfer> {
    return this.stripe.transfers.create(
      {
        amount: amountCents,
        currency: currency.toLowerCase(),
        destination: destinationAccountId,
        ...(metadata ? { metadata } : {}),
      },
      { idempotencyKey },
    );
  }
}
