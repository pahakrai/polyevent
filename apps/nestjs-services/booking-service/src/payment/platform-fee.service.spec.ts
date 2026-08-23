import { PlatformFeeService } from './platform-fee.service';

// Avoid loading the real ConfigService (which pulls in the DB client).
jest.mock('../config/config.service', () => ({
  ConfigService: class {},
}));

function makeService(opts: {
  enabled: boolean;
  percent: number;
  flatCents: number;
  minimumCents: number;
}) {
  const config = {
    getBool: jest.fn((k: string) => (k === 'platform.fee.enabled' ? opts.enabled : false)),
    getNumber: jest.fn((k: string) => {
      switch (k) {
        case 'platform.fee.percent':
          return opts.percent;
        case 'platform.fee.flat_cents':
          return opts.flatCents;
        case 'platform.fee.minimum_cents':
          return opts.minimumCents;
        default:
          return 0;
      }
    }),
  };
  return new PlatformFeeService(config as any);
}

describe('PlatformFeeService', () => {
  it('returns zero fee when disabled (free mode)', async () => {
    const svc = makeService({ enabled: false, percent: 10, flatCents: 0, minimumCents: 0 });
    const result = await svc.calculateFee(1000);
    expect(result.enabled).toBe(false);
    expect(result.feeAmountCents).toBe(0);
    expect(result.netAmountCents).toBe(1000);
  });

  it('computes percentage + flat fee', async () => {
    const svc = makeService({ enabled: true, percent: 5, flatCents: 100, minimumCents: 0 });
    const result = await svc.calculateFee(2000);
    // 5% of 2000 = 100, plus flat 100 = 200 total fee
    expect(result.feeAmountCents).toBe(200);
    expect(result.netAmountCents).toBe(1800);
  });

  it('applies the minimum-fee floor', async () => {
    const svc = makeService({ enabled: true, percent: 1, flatCents: 0, minimumCents: 250 });
    const result = await svc.calculateFee(1000);
    // 1% = 10, but minimum 250 wins
    expect(result.feeAmountCents).toBe(250);
    expect(result.netAmountCents).toBe(750);
  });

  it('never returns a negative net amount', async () => {
    const svc = makeService({ enabled: true, percent: 50, flatCents: 500, minimumCents: 0 });
    const result = await svc.calculateFee(100);
    expect(result.feeAmountCents).toBeGreaterThanOrEqual(0);
    expect(result.netAmountCents).toBe(0);
  });
});
