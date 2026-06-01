import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

export interface FeeCalculation {
  enabled: boolean;
  feePercent: number;
  flatFeeCents: number;
  minimumFeeCents: number;
  feeAmountCents: number;
  netAmountCents: number;
}

@Injectable()
export class PlatformFeeService {
  private readonly logger = new Logger(PlatformFeeService.name);

  constructor(private readonly config: ConfigService) {
    const enabled = this.config.getBool('platform.fee.enabled');
    const pct = this.config.getNumber('platform.fee.percent');
    this.logger.log(`Platform fees: enabled=${enabled}, percent=${pct}%`);
  }

  async calculateFee(amountCents: number): Promise<FeeCalculation> {
    const enabled = this.config.getBool('platform.fee.enabled');

    if (!enabled) {
      return {
        enabled: false,
        feePercent: 0,
        flatFeeCents: 0,
        minimumFeeCents: 0,
        feeAmountCents: 0,
        netAmountCents: amountCents,
      };
    }

    const feePercent = this.config.getNumber('platform.fee.percent');
    const flatFeeCents = this.config.getNumber('platform.fee.flat_cents');
    const minimumFeeCents = this.config.getNumber('platform.fee.minimum_cents');

    const variableFee = Math.round(amountCents * (feePercent / 100));
    const totalFee = Math.max(minimumFeeCents, flatFeeCents + variableFee);
    const net = Math.max(0, amountCents - totalFee);

    return {
      enabled: true,
      feePercent,
      flatFeeCents,
      minimumFeeCents,
      feeAmountCents: totalFee,
      netAmountCents: net,
    };
  }
}
