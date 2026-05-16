import { Test, TestingModule } from '@nestjs/testing';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

describe('TrackingController', () => {
  let controller: TrackingController;
  const mockTrackingService = {
    trackActivity: jest.fn(),
    trackSearch: jest.fn(),
    trackRecommendationFeedback: jest.fn(),
    trackLocation: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrackingController],
      providers: [{ provide: TrackingService, useValue: mockTrackingService }],
    }).compile();

    controller = module.get<TrackingController>(TrackingController);
  });

  describe('POST /tracking/activity', () => {
    it('tracks activity and returns recorded', async () => {
      const body = { userId: 'u1', sessionId: 's1', type: 'page_view' };
      const req = { headers: { referer: '', 'user-agent': '' }, ip: '127.0.0.1' } as any;

      const result = await controller.trackActivity(body, req);

      expect(result).toEqual({ status: 'recorded' });
      expect(mockTrackingService.trackActivity).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', type: 'page_view' }),
      );
    });

    it('enriches metadata with request info', async () => {
      const body = { userId: 'u1', sessionId: 's1', type: 'click', metadata: { target: 'button' } };
      const req = { headers: { referer: 'https://example.com', 'user-agent': 'Chrome' }, ip: '10.0.0.1' } as any;

      await controller.trackActivity(body, req);

      expect(mockTrackingService.trackActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            target: 'button',
            pageUrl: 'https://example.com',
            userAgent: 'Chrome',
          }),
        }),
      );
    });

    it('uses empty string for missing referer', async () => {
      const body = { userId: 'u1', sessionId: 's1', type: 'view' };
      const req = { headers: {}, ip: '127.0.0.1' } as any;

      await controller.trackActivity(body, req);

      expect(mockTrackingService.trackActivity).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ pageUrl: '' }) }),
      );
    });
  });

  describe('POST /tracking/search', () => {
    it('tracks search event', async () => {
      const body = {
        userId: 'u1',
        sessionId: 's1',
        searchId: 'search-1',
        query: 'jazz',
        filters: { category: 'music' },
        resultCount: 10,
      };

      const result = await controller.trackSearch(body);

      expect(result).toEqual({ status: 'recorded' });
      expect(mockTrackingService.trackSearch).toHaveBeenCalledWith(body);
    });
  });

  describe('POST /tracking/feedback', () => {
    it('tracks impression feedback', async () => {
      const body = {
        userId: 'u1',
        sessionId: 's1',
        recommendationId: 'rec-1',
        modelId: 'model-v2',
        modelVersion: '2.1',
        type: 'impression' as const,
        placement: { page: 'home', widget: 'recommended' },
        items: [{ id: 'evt-1', score: 0.9 }],
      };

      const result = await controller.trackFeedback(body);

      expect(result).toEqual({ status: 'recorded' });
      expect(mockTrackingService.trackRecommendationFeedback).toHaveBeenCalledWith(body);
    });

    it('tracks conversion feedback', async () => {
      const body = {
        userId: 'u1',
        sessionId: 's1',
        recommendationId: 'rec-2',
        modelId: 'model-v2',
        modelVersion: '2.1',
        type: 'conversion' as const,
        placement: { page: 'home', widget: 'recommended' },
        items: [{ id: 'evt-3', score: 0.95 }],
      };

      await controller.trackFeedback(body);

      expect(mockTrackingService.trackRecommendationFeedback).toHaveBeenCalledWith(body);
    });
  });

  describe('POST /tracking/location', () => {
    it('tracks nearby search location', async () => {
      const body = {
        userId: 'u1',
        sessionId: 's1',
        type: 'nearby_search' as const,
        location: { latitude: 40.7128, longitude: -74.006, city: 'NYC' },
      };

      const result = await controller.trackLocation(body);

      expect(result).toEqual({ status: 'recorded' });
      expect(mockTrackingService.trackLocation).toHaveBeenCalledWith(body);
    });

    it('tracks map pan location', async () => {
      const body = {
        userId: 'u1',
        sessionId: 's1',
        type: 'map_pan' as const,
        location: { latitude: 41.0, longitude: -73.0 },
        metadata: { zoom: 12 },
      };

      await controller.trackLocation(body);

      expect(mockTrackingService.trackLocation).toHaveBeenCalledWith(body);
    });
  });
});
