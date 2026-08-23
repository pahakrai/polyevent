import { ConflictException } from '@nestjs/common';
import { RefundService } from './refund.service';

jest.mock('../database/client', () => {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.from = jest.fn(() => chain);
  chain.where = jest.fn(() => chain);
  chain.limit = jest.fn();
  chain.insert = jest.fn(() => chain);
  chain.values = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.set = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
  return { db: chain };
});

describe('RefundService', () => {
  const stripeService = { refundPaymentIntent: jest.fn() };
  const nestConfig = { get: jest.fn(() => 'http://localhost:3004') };

  function makeService() {
    return new RefundService(stripeService as any, nestConfig as any);
  }

  beforeEach(() => jest.clearAllMocks());

  it('is idempotent for an already-refunded booking', async () => {
    const db = require('../database/client').db;
    db.limit.mockResolvedValue([{ id: 'b1', status: 'REFUNDED', totalAmount: 1000 }]);

    const svc = makeService();
    const result = await svc.refund({ bookingId: 'b1' });

    expect(result.alreadyRefunded).toBe(true);
    expect(stripeService.refundPaymentIntent).not.toHaveBeenCalled();
  });

  it('rejects refunds for non-refundable statuses', async () => {
    const db = require('../database/client').db;
    db.limit.mockResolvedValue([{ id: 'b2', status: 'CANCELLED', totalAmount: 1000 }]);

    const svc = makeService();
    await expect(svc.refund({ bookingId: 'b2' })).rejects.toThrow(ConflictException);
    expect(stripeService.refundPaymentIntent).not.toHaveBeenCalled();
  });
});
