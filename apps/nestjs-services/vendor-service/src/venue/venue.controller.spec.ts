import { Test, TestingModule } from '@nestjs/testing';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';

describe('VenueController', () => {
  let controller: VenueController;
  const mockVenueService = {
    create: jest.fn(),
    findByVendorId: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VenueController],
      providers: [{ provide: VenueService, useValue: mockVenueService }],
    }).compile();

    controller = module.get<VenueController>(VenueController);
  });

  const baseVenue = {
    id: 'venue-1',
    vendorId: 'v-1',
    name: 'Main Hall',
    type: 'INDOOR',
    capacity: 200,
  };

  describe('POST /vendors/:vendorId/venues', () => {
    it('creates a venue, merging vendorId into dto', async () => {
      const dto = { name: 'Main Hall', type: 'INDOOR', capacity: 200, address: { city: 'NYC' } };
      mockVenueService.create.mockResolvedValue(baseVenue);

      const result = await controller.create('v-1', dto);

      expect(result).toEqual(baseVenue);
      expect(mockVenueService.create).toHaveBeenCalledWith({ ...dto, vendorId: 'v-1' });
    });

    it('creates venue with all fields', async () => {
      const dto = {
        name: 'Grand Ballroom',
        type: 'BALLROOM',
        capacity: 500,
        description: 'A grand hall',
        address: { street: '1 Park Ave', city: 'NYC', country: 'US' },
        coordinates: { lat: 40.7, lon: -74.0 },
      };
      mockVenueService.create.mockResolvedValue({ id: 'venue-2', vendorId: 'v-1', ...dto });

      const result = await controller.create('v-1', dto);

      expect(result.name).toBe('Grand Ballroom');
      expect(mockVenueService.create).toHaveBeenCalledWith({ ...dto, vendorId: 'v-1' });
    });
  });

  describe('GET /vendors/:vendorId/venues', () => {
    it('returns venues for a vendor', async () => {
      mockVenueService.findByVendorId.mockResolvedValue([baseVenue]);

      const result = await controller.findByVendorId('v-1');

      expect(result).toEqual([baseVenue]);
      expect(mockVenueService.findByVendorId).toHaveBeenCalledWith('v-1');
    });

    it('returns empty array when vendor has no venues', async () => {
      mockVenueService.findByVendorId.mockResolvedValue([]);

      const result = await controller.findByVendorId('v-empty');

      expect(result).toEqual([]);
    });
  });

  describe('GET /venues/:id', () => {
    it('returns venue by id', async () => {
      mockVenueService.findById.mockResolvedValue(baseVenue);

      const result = await controller.findById('venue-1');

      expect(result).toEqual(baseVenue);
      expect(mockVenueService.findById).toHaveBeenCalledWith('venue-1');
    });

    it('returns null when not found', async () => {
      mockVenueService.findById.mockResolvedValue(null);

      const result = await controller.findById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('PATCH /venues/:id', () => {
    it('updates a venue', async () => {
      const dto = { name: 'Updated Hall', capacity: 300 };
      const updated = { ...baseVenue, ...dto };
      mockVenueService.update.mockResolvedValue(updated);

      const result = await controller.update('venue-1', dto);

      expect(result.name).toBe('Updated Hall');
      expect(result.capacity).toBe(300);
      expect(mockVenueService.update).toHaveBeenCalledWith('venue-1', dto);
    });
  });

  describe('DELETE /venues/:id', () => {
    it('removes a venue', async () => {
      mockVenueService.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove('venue-1');

      expect(result).toEqual({ deleted: true });
      expect(mockVenueService.remove).toHaveBeenCalledWith('venue-1');
    });

    it('throws when venue not found', async () => {
      mockVenueService.remove.mockRejectedValue(new Error('Venue not found'));

      await expect(controller.remove('unknown')).rejects.toThrow('Venue not found');
    });
  });
});
