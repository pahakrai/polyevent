import { Controller, Post } from '@nestjs/common';
import { PayoutService } from './payout.service';

/**
 * Manual/admin trigger for the payout sweep. In production this would be driven
 * by a scheduler (e.g. BullMQ repeatable job), not a public HTTP endpoint.
 */
@Controller('payouts')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Post('process')
  async process() {
    return this.payoutService.processScheduledPayouts();
  }
}
