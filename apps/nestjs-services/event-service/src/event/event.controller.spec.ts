import { Test, TestingModule } from '@nestjs/testing';
import { EventController } from './event.controller';
import { EventService } from './event.service';

describe('EventController', () => {
  let controller: EventController;
  const mockEventService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByVendor: jest.fn(),
    update: jest.fn(),
    publish: jest.fn(),
    cancel: jest.fn(),
    complete: jest.fn(),
    markSoldOut: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventController],
      providers: [{ provide: EventService, useValue: mockEventService }],
    }).compile();

    controller = module.get<EventController>(EventController);
  });

  const baseEvent = {
    id: 'evt-1',
    vendorId: 'v-1',
    title: 'Jazz Night',
    description: 'A great jazz event',
    category: 'music',
    status: 'DRAFT',
  };

  describe('POST /events', () => {
    it('creates an event', async () => {
      const dto = {
        vendorId: 'v-1',
        title: 'Jazz Night',
        description: 'A great jazz event',
        category: 'music',
        startTime: '2026-06-01T19:00:00Z',
        endTime: '2026-06-01T22:00:00Z',
        location: { name: 'Blue Note', city: 'NYC' },
        price: { minPrice: 20 },
      };
      mockEventService.create.mockResolvedValue({ ...baseEvent, ...dto });

      const result = await controller.create(dto);

      expect(result.title).toBe('Jazz Night');
      expect(mockEventService.create).toHaveBeenCalledWith(dto);
    });

    it('creates an event with optional fields', async () => {
      const dto = {
        vendorId: 'v-1',
        title: 'Full Event',
        description: 'Desc',
        category: 'sports',
        startTime: '2026-06-01T19:00:00Z',
        endTime: '2026-06-01T22:00:00Z',
        location: { city: 'LA' },
        price: {},
        tags: ['outdoor', 'fun'],
        maxAttendees: 100,
        images: ['img1.jpg'],
      };
      mockEventService.create.mockResolvedValue({ id: 'evt-2', ...dto });

      const result = await controller.create(dto);

      expect(result.tags).toContain('outdoor');
      expect(result.maxAttendees).toBe(100);
    });
  });

  describe('GET /events', () => {
    it('returns paginated events with defaults', async () => {
      const events = [baseEvent];
      mockEventService.findAll.mockResolvedValue(events);

      const result = await controller.findAll(1, 20);

      expect(result).toEqual(events);
      expect(mockEventService.findAll).toHaveBeenCalledWith(1, 20);
    });

    it('passes custom page and limit', async () => {
      mockEventService.findAll.mockResolvedValue([]);

      await controller.findAll(3, 50);

      expect(mockEventService.findAll).toHaveBeenCalledWith(3, 50);
    });
  });

  describe('GET /events/:id', () => {
    it('returns event by id', async () => {
      mockEventService.findById.mockResolvedValue(baseEvent);

      const result = await controller.findById('evt-1');

      expect(result).toEqual(baseEvent);
      expect(mockEventService.findById).toHaveBeenCalledWith('evt-1');
    });

    it('returns null when not found', async () => {
      mockEventService.findById.mockResolvedValue(null);

      const result = await controller.findById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('PATCH /events/:id', () => {
    it('updates an event', async () => {
      const dto = { title: 'Updated Title' };
      const updated = { ...baseEvent, title: 'Updated Title' };
      mockEventService.update.mockResolvedValue(updated);

      const result = await controller.update('evt-1', dto);

      expect(result.title).toBe('Updated Title');
      expect(mockEventService.update).toHaveBeenCalledWith('evt-1', dto);
    });

    it('updates with all fields', async () => {
      const dto = { title: 'New', description: 'New desc', tags: ['tag1'] };
      mockEventService.update.mockResolvedValue({ ...baseEvent, ...dto });

      const result = await controller.update('evt-1', dto);

      expect(result.tags).toContain('tag1');
    });
  });

  describe('POST /events/:id/publish', () => {
    it('publishes an event', async () => {
      const published = { ...baseEvent, status: 'PUBLISHED' };
      mockEventService.publish.mockResolvedValue(published);

      const result = await controller.publish('evt-1');

      expect(result.status).toBe('PUBLISHED');
      expect(mockEventService.publish).toHaveBeenCalledWith('evt-1');
    });

    it('throws when event is not in DRAFT status', async () => {
      mockEventService.publish.mockRejectedValue(new Error('Only DRAFT events can be published'));

      await expect(controller.publish('evt-1')).rejects.toThrow('Only DRAFT events can be published');
    });
  });

  describe('POST /events/:id/cancel', () => {
    it('cancels an event with reason', async () => {
      const cancelled = { ...baseEvent, status: 'CANCELLED' };
      mockEventService.cancel.mockResolvedValue(cancelled);

      const result = await controller.cancel('evt-1', 'Weather');

      expect(result.status).toBe('CANCELLED');
      expect(mockEventService.cancel).toHaveBeenCalledWith('evt-1', 'Weather');
    });

    it('cancels without reason', async () => {
      mockEventService.cancel.mockResolvedValue({ ...baseEvent, status: 'CANCELLED' });

      const result = await controller.cancel('evt-1');

      expect(result.status).toBe('CANCELLED');
      expect(mockEventService.cancel).toHaveBeenCalledWith('evt-1', undefined);
    });
  });

  describe('POST /events/:id/complete', () => {
    it('completes an event', async () => {
      const completed = { ...baseEvent, status: 'COMPLETED' };
      mockEventService.complete.mockResolvedValue(completed);

      const result = await controller.complete('evt-1');

      expect(result.status).toBe('COMPLETED');
      expect(mockEventService.complete).toHaveBeenCalledWith('evt-1');
    });

    it('throws when event not found', async () => {
      mockEventService.complete.mockRejectedValue(new Error('Event not found'));

      await expect(controller.complete('unknown')).rejects.toThrow('Event not found');
    });
  });

  describe('POST /events/:id/sold-out', () => {
    it('marks event as sold out', async () => {
      const soldOut = { ...baseEvent, status: 'SOLD_OUT' };
      mockEventService.markSoldOut.mockResolvedValue(soldOut);

      const result = await controller.markSoldOut('evt-1');

      expect(result.status).toBe('SOLD_OUT');
      expect(mockEventService.markSoldOut).toHaveBeenCalledWith('evt-1');
    });
  });

  describe('GET /events/vendor/:vendorId', () => {
    it('returns vendor events with pagination', async () => {
      const events = [{ ...baseEvent, vendorId: 'v-1' }];
      mockEventService.findByVendor.mockResolvedValue(events);

      const result = await controller.findByVendor('v-1', 1, 20);

      expect(result).toEqual(events);
      expect(mockEventService.findByVendor).toHaveBeenCalledWith('v-1', 1, 20);
    });

    it('returns empty array for vendor with no events', async () => {
      mockEventService.findByVendor.mockResolvedValue([]);

      const result = await controller.findByVendor('v-empty', 1, 20);

      expect(result).toEqual([]);
    });
  });
});
