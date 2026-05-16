import { Test, TestingModule } from '@nestjs/testing';
import { EventSearchController } from './event-search.controller';
import { EventService } from './event.service';

describe('EventSearchController', () => {
  let controller: EventSearchController;
  const mockEventService = {
    search: jest.fn(),
    findByCategory: jest.fn(),
    findNearby: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventSearchController],
      providers: [{ provide: EventService, useValue: mockEventService }],
    }).compile();

    controller = module.get<EventSearchController>(EventSearchController);
  });

  describe('GET /events/search', () => {
    it('searches with query', async () => {
      const results = [{ id: 'evt-1', title: 'Jazz Night' }];
      mockEventService.search.mockResolvedValue(results);
      const dto = { query: 'jazz' };

      const result = await controller.search(dto);

      expect(result).toEqual(results);
      expect(mockEventService.search).toHaveBeenCalledWith(dto);
    });

    it('searches with filters', async () => {
      mockEventService.search.mockResolvedValue([]);
      const dto = { query: 'music', categories: ['jazz'], tags: ['live'], lat: 40.7, lon: -74.0, radiusKm: 10 };

      await controller.search(dto);

      expect(mockEventService.search).toHaveBeenCalledWith(dto);
    });

    it('returns empty results', async () => {
      mockEventService.search.mockResolvedValue([]);

      const result = await controller.search({ query: 'nonexistent' });

      expect(result).toEqual([]);
    });
  });

  describe('GET /events/category/:category', () => {
    it('returns events by category with pagination', async () => {
      const events = [{ id: 'evt-1', title: 'Rock Show', category: 'music' }];
      mockEventService.findByCategory.mockResolvedValue(events);

      const result = await controller.findByCategory('music', 1, 20);

      expect(result).toEqual(events);
      expect(mockEventService.findByCategory).toHaveBeenCalledWith('music', 1, 20);
    });

    it('returns empty for unknown category', async () => {
      mockEventService.findByCategory.mockResolvedValue([]);

      const result = await controller.findByCategory('unknown', 1, 20);

      expect(result).toEqual([]);
    });
  });

  describe('GET /events/nearby', () => {
    it('returns nearby events', async () => {
      const events = [{ id: 'evt-1', title: 'Nearby Event' }];
      mockEventService.findNearby.mockResolvedValue(events);

      const result = await controller.findNearby(40.7128, -74.006, 20, 1, 20);

      expect(result).toEqual(events);
      expect(mockEventService.findNearby).toHaveBeenCalledWith(40.7128, -74.006, 20, 1, 20);
    });

    it('uses default radiusKm when not provided', async () => {
      mockEventService.findNearby.mockResolvedValue([]);

      await controller.findNearby(40.7, -74.0, 20, 1, 20);

      expect(mockEventService.findNearby).toHaveBeenCalledWith(40.7, -74.0, 20, 1, 20);
    });
  });
});
