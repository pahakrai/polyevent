import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { VendorInternalController } from './vendor-internal.controller';
import { VendorService } from './vendor.service';

describe('VendorInternalController', () => {
  let controller: VendorInternalController;
  const mockVendorService = {
    create: jest.fn(),
    deleteById: jest.fn(),
    findByUserId: jest.fn(),
  };

  const validKey = 'test-internal-key';

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.INTERNAL_SERVICE_KEY = validKey;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorInternalController],
      providers: [{ provide: VendorService, useValue: mockVendorService }],
    }).compile();

    controller = module.get<VendorInternalController>(VendorInternalController);
  });

  afterEach(() => {
    delete process.env.INTERNAL_SERVICE_KEY;
  });

  describe('POST /internal/vendors', () => {
    const dto = {
      businessName: 'Internal Biz',
      category: 'MUSIC',
      contactEmail: 'biz@test.com',
      contactPhone: '555-9999',
      address: { street: '1 Main' },
      location: { lat: 40.7, lon: -74.0 },
    };

    it('creates vendor with valid internal key', async () => {
      const created = { id: 'v-int-1', ...dto };
      mockVendorService.create.mockResolvedValue(created);

      const result = await controller.create(validKey, dto);

      expect(result).toEqual(created);
      expect(mockVendorService.create).toHaveBeenCalledWith(dto);
    });

    it('throws UnauthorizedException with invalid key', () => {
      expect(() => controller.create('wrong-key', dto)).toThrow(UnauthorizedException);
      expect(mockVendorService.create).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException with missing key', () => {
      expect(() => controller.create(undefined as any, dto)).toThrow(UnauthorizedException);
    });
  });

  describe('DELETE /internal/vendors/:id', () => {
    it('deletes vendor with valid internal key', async () => {
      mockVendorService.deleteById.mockResolvedValue({ deleted: true });

      const result = await controller.delete(validKey, 'v-int-1');

      expect(result).toEqual({ deleted: true });
      expect(mockVendorService.deleteById).toHaveBeenCalledWith('v-int-1');
    });

    it('throws UnauthorizedException with invalid key', () => {
      expect(() => controller.delete('bad-key', 'v-int-1')).toThrow(UnauthorizedException);
    });
  });

  describe('GET /internal/vendors/by-user/:userId', () => {
    it('finds vendors by user with valid key', async () => {
      const vendors = [{ id: 'v-int-1', businessName: 'Biz' }];
      mockVendorService.findByUserId.mockResolvedValue(vendors);

      const result = await controller.findByUserId(validKey, 'user-1');

      expect(result).toEqual(vendors);
      expect(mockVendorService.findByUserId).toHaveBeenCalledWith('user-1');
    });

    it('throws UnauthorizedException with invalid key', () => {
      expect(() => controller.findByUserId('bad-key', 'user-1')).toThrow(UnauthorizedException);
    });
  });
});
