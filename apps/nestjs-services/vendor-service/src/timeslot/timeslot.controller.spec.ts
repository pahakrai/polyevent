import { Test, TestingModule } from '@nestjs/testing';
import { TimeslotController } from './timeslot.controller';
import { TimeslotService } from './timeslot.service';

describe('TimeslotController', () => {
  let controller: TimeslotController;
  const mockTimeslotService = {
    create: jest.fn(),
    createBulk: jest.fn(),
    findByVenueId: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    block: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimeslotController],
      providers: [{ provide: TimeslotService, useValue: mockTimeslotService }],
    }).compile();

    controller = module.get<TimeslotController>(TimeslotController);
  });

  const baseSlot = {
    id: 'slot-1',
    venueId: 'venue-1',
    startTime: new Date('2026-06-01T09:00:00Z'),
    endTime: new Date('2026-06-01T11:00:00Z'),
    status: 'AVAILABLE' as const,
    recurrenceRule: null,
    priceOverride: null,
    maxBookings: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('POST /venues/:venueId/timeslots', () => {
    it('creates a timeslot, merging venueId into dto', async () => {
      const dto = {
        venueId: 'venue-1',
        startTime: '2026-06-01T09:00:00Z',
        endTime: '2026-06-01T11:00:00Z',
      };
      mockTimeslotService.create.mockResolvedValue(baseSlot);

      const result = await controller.create('venue-1', dto);

      expect(result).toEqual(baseSlot);
      expect(mockTimeslotService.create).toHaveBeenCalledWith({ ...dto, venueId: 'venue-1' });
    });

    it('creates timeslot with all optional fields', async () => {
      const dto = {
        venueId: 'venue-1',
        startTime: '2026-06-01T14:00:00Z',
        endTime: '2026-06-01T16:00:00Z',
        maxBookings: 50,
        priceOverride: { amount: 150, currency: 'USD' },
      };
      const created = { ...baseSlot, maxBookings: 50, priceOverride: { amount: 150, currency: 'USD' } };
      mockTimeslotService.create.mockResolvedValue(created);

      const result = await controller.create('venue-1', dto);

      expect(result.maxBookings).toBe(50);
      expect(mockTimeslotService.create).toHaveBeenCalledWith({ ...dto, venueId: 'venue-1' });
    });
  });

  describe('POST /venues/:venueId/timeslots/bulk', () => {
    it('creates timeslots in bulk', async () => {
      const dto = {
        venueId: 'venue-1',
        startDate: '2026-06-01',
        endDate: '2026-06-07',
        daysOfWeek: [1, 3, 5],
        startTime: '09:00',
        endTime: '11:00',
      };
      mockTimeslotService.createBulk.mockResolvedValue({ count: 3 });

      const result = await controller.createBulk('venue-1', dto);

      expect(result.count).toBe(3);
      expect(mockTimeslotService.createBulk).toHaveBeenCalledWith({ ...dto, venueId: 'venue-1' });
    });

    it('creates bulk with price override', async () => {
      const dto = {
        venueId: 'venue-1',
        startDate: '2026-06-01',
        endDate: '2026-06-07',
        daysOfWeek: [1, 3, 5],
        startTime: '09:00',
        endTime: '11:00',
        priceOverride: { amount: 100, currency: 'USD' },
      };
      mockTimeslotService.createBulk.mockResolvedValue({ count: 3 });

      await controller.createBulk('venue-1', dto);

      expect(mockTimeslotService.createBulk).toHaveBeenCalledWith({ ...dto, venueId: 'venue-1' });
    });
  });

  describe('GET /venues/:venueId/timeslots', () => {
    it('returns timeslots for a venue', async () => {
      mockTimeslotService.findByVenueId.mockResolvedValue([baseSlot]);

      const result = await controller.findByVenueId('venue-1');

      expect(result).toEqual([baseSlot]);
      expect(mockTimeslotService.findByVenueId).toHaveBeenCalledWith('venue-1', undefined, undefined);
    });

    it('filters by date range', async () => {
      mockTimeslotService.findByVenueId.mockResolvedValue([baseSlot]);

      await controller.findByVenueId('venue-1', '2026-06-01', '2026-06-30');

      expect(mockTimeslotService.findByVenueId).toHaveBeenCalledWith(
        'venue-1', '2026-06-01', '2026-06-30',
      );
    });

    it('returns empty when no timeslots exist', async () => {
      mockTimeslotService.findByVenueId.mockResolvedValue([]);

      const result = await controller.findByVenueId('venue-empty');

      expect(result).toEqual([]);
    });
  });

  describe('GET /timeslots/:id', () => {
    it('returns timeslot by id', async () => {
      mockTimeslotService.findById.mockResolvedValue(baseSlot);

      const result = await controller.findById('slot-1');

      expect(result).toEqual(baseSlot);
      expect(mockTimeslotService.findById).toHaveBeenCalledWith('slot-1');
    });

    it('returns null when not found', async () => {
      mockTimeslotService.findById.mockResolvedValue(null);

      const result = await controller.findById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('PATCH /timeslots/:id', () => {
    it('updates a timeslot', async () => {
      const dto = { priceOverride: { amount: 200, currency: 'USD' }, maxBookings: 75 };
      const updated = { ...baseSlot, ...dto };
      mockTimeslotService.update.mockResolvedValue(updated);

      const result = await controller.update('slot-1', dto);

      expect(result.maxBookings).toBe(75);
      expect(mockTimeslotService.update).toHaveBeenCalledWith('slot-1', dto);
    });
  });

  describe('DELETE /timeslots/:id', () => {
    it('removes a timeslot', async () => {
      mockTimeslotService.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove('slot-1');

      expect(result).toEqual({ deleted: true });
      expect(mockTimeslotService.remove).toHaveBeenCalledWith('slot-1');
    });

    it('throws when timeslot not found', async () => {
      mockTimeslotService.remove.mockRejectedValue(new Error('Timeslot not found'));

      await expect(controller.remove('unknown')).rejects.toThrow('Timeslot not found');
    });
  });

  describe('POST /timeslots/:id/block', () => {
    it('blocks a timeslot', async () => {
      const blocked = { ...baseSlot, status: 'BLOCKED' as const };
      mockTimeslotService.block.mockResolvedValue(blocked);

      const result = await controller.block('slot-1');

      expect(result.status).toBe('BLOCKED');
      expect(mockTimeslotService.block).toHaveBeenCalledWith('slot-1');
    });

    it('throws when already blocked', async () => {
      mockTimeslotService.block.mockRejectedValue(new Error('Timeslot already blocked'));

      await expect(controller.block('slot-1')).rejects.toThrow('Timeslot already blocked');
    });
  });
});
