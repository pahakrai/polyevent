import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { eq, sql } from 'drizzle-orm';
import { db } from '../database/client';
import { vendorPayouts } from '../database/schema';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);
  private readonly enabled: boolean;

  constructor(configService: ConfigService) {
    this.enabled = configService.getBool('booking.payouts_enabled');
    this.logger.log(`Payouts: enabled=${this.enabled}`);
  }

  /**
   * Process scheduled payouts.
   * When platform fees are disabled (free mode), this is a no-op.
   * When enabled, this would execute Stripe Transfers to vendor connected accounts.
   */
  async processScheduledPayouts(): Promise<number> {
    if (!this.enabled) {
      this.logger.debug('Payouts disabled — skipping processing');
      return 0;
    }

    const scheduled = await db
      .select()
      .from(vendorPayouts)
      .where(eq(vendorPayouts.status, 'SCHEDULED'))
      .limit(50);

    let processed = 0;
    for (const payout of scheduled) {
      try {
        await db
          .update(vendorPayouts)
          .set({
            status: 'PROCESSING',
          })
          .where(eq(vendorPayouts.id, payout.id));

        // TODO: Execute Stripe Transfer to vendor connected account
        // const transfer = await stripe.transfers.create({ ... });

        await db
          .update(vendorPayouts)
          .set({
            status: 'COMPLETED',
            paidAt: new Date(),
            // stripeTransferId: transfer.id,
          })
          .where(eq(vendorPayouts.id, payout.id));

        processed++;
      } catch (err) {
        this.logger.error(`Payout ${payout.id} failed: ${(err as Error).message}`);
        await db
          .update(vendorPayouts)
          .set({ status: 'FAILED', metadata: { error: (err as Error).message } })
          .where(eq(vendorPayouts.id, payout.id));
      }
    }

    if (processed > 0) {
      this.logger.log(`Processed ${processed} payouts`);
    }
    return processed;
  }
}
