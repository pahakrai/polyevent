import { Test, TestingModule } from '@nestjs/testing';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';

describe('VendorController', () => {
  let controller: VendorController;
  const mockVendorService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByUserId: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    verify: jest.fn(),
    getStats: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorController],
      providers: [{ provide: VendorService, useValue: mockVendorService }],
    }).compile();

    controller = module.get<VendorController>(VendorController);
  });

  const baseVendor = {
    id: 'v-1',
    businessName: 'My Business',
    category: 'MUSIC',
    status: 'PENDING',
  };

  describe('POST /vendors', () => {
    it('creates a vendor', async () => {
      const dto = {
        businessName: 'My Business',
        category: 'MUSIC',
        contactEmail: 'vendor@test.com',
        contactPhone: '555-1234',
        address: { street: '123 Main' },
        location: { lat: 40.7, lon: -74.0 },
      };
      mockVendorService.create.mockResolvedValue(baseVendor);

      const result = await controller.create(dto);

      expect(result).toEqual(baseVendor);
      expect(mockVendorService.create).toHaveBeenCalledWith(dto);
    });

    it('creates vendor with all optional fields', async () => {
      const dto = {
        businessName: 'Full Business',
        category: 'ART',
        subCategory: 'Painting',
        description: 'An art studio',
        website: 'https://art.com',
        coverImage: 'cover.jpg',
        contactEmail: 'art@test.com',
        contactPhone: '555-5678',
        address: { street: '456 Oak' },
        location: { lat: 41.0, lon: -73.0 },
      };
      mockVendorService.create.mockResolvedValue({ id: 'v-2', ...dto });

      const result = await controller.create(dto);

      expect(result.businessName).toBe('Full Business');
      expect(result.subCategory).toBe('Painting');
    });
  });

  describe('GET /vendors', () => {
    it('returns paginated vendors', async () => {
      mockVendorService.findAll.mockResolvedValue([baseVendor]);

      const result = await controller.findAll(1, 20);

      expect(result).toEqual([baseVendor]);
      expect(mockVendorService.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('filters by category', async () => {
      mockVendorService.findAll.mockResolvedValue([]);

      await controller.findAll(1, 20, 'MUSIC');

      expect(mockVendorService.findAll).toHaveBeenCalledWith(1, 20, 'MUSIC');
    });

    it('uses custom page and limit', async () => {
      mockVendorService.findAll.mockResolvedValue([]);

      await controller.findAll(2, 10);

      expect(mockVendorService.findAll).toHaveBeenCalledWith(2, 10, undefined);
    });
  });

  describe('GET /vendors/user/:userId', () => {
    it('returns vendors for a user', async () => {
      mockVendorService.findByUserId.mockResolvedValue([baseVendor]);

      const result = await controller.findByUserId('user-1');

      expect(result).toEqual([baseVendor]);
      expect(mockVendorService.findByUserId).toHaveBeenCalledWith('user-1');
    });

    it('returns empty array when user has no vendors', async () => {
      mockVendorService.findByUserId.mockResolvedValue([]);

      const result = await controller.findByUserId('user-empty');

      expect(result).toEqual([]);
    });
  });

  describe('GET /vendors/:id', () => {
    it('returns vendor by id', async () => {
      mockVendorService.findById.mockResolvedValue(baseVendor);

      const result = await controller.findById('v-1');

      expect(result).toEqual(baseVendor);
      expect(mockVendorService.findById).toHaveBeenCalledWith('v-1');
    });

    it('returns null when not found', async () => {
      mockVendorService.findById.mockResolvedValue(null);

      const result = await controller.findById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('PATCH /vendors/:id', () => {
    it('updates a vendor', async () => {
      const dto = { businessName: 'Updated Name', description: 'New desc' };
      const updated = { ...baseVendor, ...dto };
      mockVendorService.update.mockResolvedValue(updated);

      const result = await controller.update('v-1', dto);

      expect(result.businessName).toBe('Updated Name');
      expect(mockVendorService.update).toHaveBeenCalledWith('v-1', dto);
    });
  });

  describe('POST /vendors/:id/verify', () => {
    it('verifies a vendor', async () => {
      const verified = { ...baseVendor, status: 'VERIFIED' };
      mockVendorService.verify.mockResolvedValue(verified);

      const result = await controller.verify('v-1');

      expect(result.status).toBe('VERIFIED');
      expect(mockVendorService.verify).toHaveBeenCalledWith('v-1');
    });
  });

  describe('GET /vendors/:id/stats', () => {
    it('returns vendor stats', async () => {
      const stats = { totalEvents: 10, totalRevenue: 5000, totalBookings: 150 };
      mockVendorService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats('v-1');

      expect(result).toEqual(stats);
      expect(mockVendorService.getStats).toHaveBeenCalledWith('v-1');
    });

    it('returns zero stats for new vendor', async () => {
      mockVendorService.getStats.mockResolvedValue({ totalEvents: 0, totalRevenue: 0, totalBookings: 0 });

      const result = await controller.getStats('v-new');

      expect(result.totalEvents).toBe(0);
    });
  });
});
