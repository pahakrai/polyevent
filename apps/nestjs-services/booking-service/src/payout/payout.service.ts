import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { eq, sql } from 'drizzle-orm';
import { db } from '../database/client';
import { vendorPayouts } from '../database/schema';
import { ConfigService } from '../config/config.service';
import { StripeService } from '../payment/stripe.service';

/**
 * Executes the vendor payout leg of the marketplace loop.
 *
 * For each SCHEDULED payout we:
 *   1. Resolve the vendor's Stripe connected account (from vendor-service).
 *   2. Transfer the net amount via a Stripe Transfer.
 *   3. Record the Stripe transfer id and mark the payout COMPLETED.
 *
 * Idempotency: the booking id is used as the Stripe transfer idempotency key,
 * so a retried processing pass never double-pays a vendor. Payouts for vendors
 * without a connected account are marked FAILED (not silently completed).
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);
  private readonly enabled: boolean;

  constructor(
    configService: ConfigService,
    private readonly nestConfig: NestConfigService,
    private readonly stripeService: StripeService,
  ) {
    this.enabled = configService.getBool('booking.payouts_enabled');
    this.logger.log(`Payouts: enabled=${this.enabled}`);
  }

  async processScheduledPayouts(): Promise<{ processed: number; failed: number }> {
    if (!this.enabled) {
      this.logger.debug('Payouts disabled — skipping processing');
      return { processed: 0, failed: 0 };
    }

    const scheduled = await db
      .select()
      .from(vendorPayouts)
      .where(eq(vendorPayouts.status, 'SCHEDULED'))
      .limit(50);

    let processed = 0;
    let failed = 0;

    for (const payout of scheduled) {
      try {
        await this.payoutOne(payout);
        processed++;
      } catch (err) {
        failed++;
        this.logger.error(`Payout ${payout.id} failed: ${(err as Error).message}`);
        await db
          .update(vendorPayouts)
          .set({
            status: 'FAILED',
            metadata: { error: (err as Error).message },
          })
          .where(eq(vendorPayouts.id, payout.id));
      }
    }

    if (processed > 0 || failed > 0) {
      this.logger.log(`Processed ${processed} payouts, ${failed} failed`);
    }
    return { processed, failed };
  }

  private async payoutOne(payout: typeof vendorPayouts.$inferSelect): Promise<void> {
    // Mark PROCESSING so concurrent runs don't double-process.
    const [claimed] = await db
      .update(vendorPayouts)
      .set({ status: 'PROCESSING' })
      .where(
        sql`${vendorPayouts.id} = ${payout.id} AND ${vendorPayouts.status} = 'SCHEDULED'`,
      )
      .returning();

    if (!claimed) {
      this.logger.debug(`Payout ${payout.id} already claimed by another worker`);
      return;
    }

    const destinationAccount = await this.resolveConnectedAccount(payout.vendorId);
    if (!destinationAccount) {
      throw new Error(
        `Vendor ${payout.vendorId} has no Stripe connected account configured`,
      );
    }

    const transfer = await this.stripeService.createTransfer(
      payout.netAmount,
      payout.currency,
      destinationAccount,
      `payout_${payout.bookingId}`, // idempotency key — never double-pay
      { bookingId: payout.bookingId, vendorId: payout.vendorId },
    );

    await db
      .update(vendorPayouts)
      .set({
        status: 'COMPLETED',
        paidAt: new Date(),
        stripeTransferId: transfer.id,
      })
      .where(eq(vendorPayouts.id, payout.id));

    this.logger.log(
      `Payout ${payout.id} completed — transfer ${transfer.id} (${payout.netAmount} ${payout.currency})`,
    );
  }

  /**
   * Resolve the vendor's Stripe connected account id from vendor-service.
   * Returns null when the vendor has not connected Stripe.
   */
  private async resolveConnectedAccount(vendorId: string): Promise<string | null> {
    const baseUrl =
      this.nestConfig.get<string>('VENDOR_SERVICE_URL') || 'http://vendor-service:3000';
    const internalKey =
      this.nestConfig.get<string>('INTERNAL_SERVICE_KEY') || 'internal-secret';

    try {
      const res = await fetch(`${baseUrl}/internal/vendors/${vendorId}`, {
        headers: { 'x-internal-key': internalKey },
      });
      if (!res.ok) {
        this.logger.warn(`vendor-service lookup for ${vendorId} returned ${res.status}`);
        return null;
      }
      const vendor = (await res.json()) as { stripeAccountId?: string | null };
      return vendor.stripeAccountId || null;
    } catch (err) {
      this.logger.warn(`Failed to resolve connected account for ${vendorId}: ${(err as Error).message}`);
      return null;
    }
  }
}
