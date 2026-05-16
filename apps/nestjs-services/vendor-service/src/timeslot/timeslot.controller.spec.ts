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
    startTime: '2026-06-01T09:00:00Z',
    endTime: '2026-06-01T11:00:00Z',
    status: 'AVAILABLE',
  };

  describe('POST /venues/:venueId/timeslots', () => {
    it('creates a timeslot, merging venueId into dto', async () => {
      const dto = { startTime: '2026-06-01T09:00:00Z', endTime: '2026-06-01T11:00:00Z', price: 100 };
      mockTimeslotService.create.mockResolvedValue(baseSlot);

      const result = await controller.create('venue-1', dto);

      expect(result).toEqual(baseSlot);
      expect(mockTimeslotService.create).toHaveBeenCalledWith({ ...dto, venueId: 'venue-1' });
    });

    it('creates timeslot with all optional fields', async () => {
      const dto = {
        startTime: '2026-06-01T14:00:00Z',
        endTime: '2026-06-01T16:00:00Z',
        price: 150,
        maxBookings: 50,
        notes: 'Afternoon slot',
      };
      mockTimeslotService.create.mockResolvedValue({ id: 'slot-2', venueId: 'venue-1', ...dto });

      const result = await controller.create('venue-1', dto);

      expect(result.price).toBe(150);
      expect(mockTimeslotService.create).toHaveBeenCalledWith({ ...dto, venueId: 'venue-1' });
    });
  });

  describe('POST /venues/:venueId/timeslots/bulk', () => {
    it('creates timeslots in bulk', async () => {
      const dto = {
        slots: [
          { startTime: '2026-06-01T09:00:00Z', endTime: '2026-06-01T11:00:00Z' },
          { startTime: '2026-06-01T11:00:00Z', endTime: '2026-06-01T13:00:00Z' },
        ],
      };
      const created = [
        { id: 'slot-1', venueId: 'venue-1', ...dto.slots[0] },
        { id: 'slot-2', venueId: 'venue-1', ...dto.slots[1] },
      ];
      mockTimeslotService.createBulk.mockResolvedValue(created);

      const result = await controller.createBulk('venue-1', dto);

      expect(result).toHaveLength(2);
      expect(mockTimeslotService.createBulk).toHaveBeenCalledWith({ ...dto, venueId: 'venue-1' });
    });

    it('creates bulk with prices', async () => {
      const dto = {
        slots: [
          { startTime: '2026-06-01T09:00:00Z', endTime: '2026-06-01T11:00:00Z', price: 100 },
          { startTime: '2026-06-01T11:00:00Z', endTime: '2026-06-01T13:00:00Z', price: 120 },
        ],
      };
      mockTimeslotService.createBulk.mockResolvedValue([]);

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
      const dto = { price: 200, maxBookings: 75 };
      const updated = { ...baseSlot, ...dto };
      mockTimeslotService.update.mockResolvedValue(updated);

      const result = await controller.update('slot-1', dto);

      expect(result.price).toBe(200);
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
      const blocked = { ...baseSlot, status: 'BLOCKED' };
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
