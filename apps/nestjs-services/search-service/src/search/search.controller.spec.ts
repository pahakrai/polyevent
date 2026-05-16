import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  const mockSearch = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: { search: mockSearch } },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  describe('POST /search', () => {
    const baseDto = { query: 'jazz', userId: 'user-1' };

    it('returns results with total count', async () => {
      mockSearch.mockResolvedValue([
        {
          id: 'evt-1',
          title: 'Jazz Night',
          category: 'music',
          genres: ['jazz'],
          personalization_score: 0.95,
          blended_score: 0.95,
          text_score: 0.9,
          ranking_features: {},
        },
      ]);

      const result = await controller.search(baseDto);

      expect(result.total).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Jazz Night');
    });

    it('includes all optional params in request', async () => {
      mockSearch.mockResolvedValue([]);

      await controller.search({
        query: 'test',
        userId: 'user-1',
        lat: 40.7128,
        lon: -74.006,
        radiusKm: 10,
        categories: ['music'],
        genres: ['rock'],
        maxPrice: 50,
        topK: 10,
        alpha: 0.7,
      });

      expect(mockSearch).toHaveBeenCalledWith({
        query: 'test',
        userId: 'user-1',
        lat: 40.7128,
        lon: -74.006,
        radiusKm: 10,
        categories: ['music'],
        genres: ['rock'],
        maxPrice: 50,
        topK: 10,
        alpha: 0.7,
      });
    });

    it('returns empty results array with zero total', async () => {
      mockSearch.mockResolvedValue([]);

      const result = await controller.search(baseDto);

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('passes alpha param through correctly', async () => {
      mockSearch.mockResolvedValue([]);

      await controller.search({ ...baseDto, alpha: 0.3 });

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ alpha: 0.3 }),
      );
    });

    it('handles undefined optional params', async () => {
      mockSearch.mockResolvedValue([]);

      await controller.search(baseDto);

      expect(mockSearch).toHaveBeenCalledWith({
        query: 'jazz',
        userId: 'user-1',
        lat: undefined,
        lon: undefined,
        radiusKm: undefined,
        categories: undefined,
        genres: undefined,
        maxPrice: undefined,
        topK: undefined,
        alpha: undefined,
      });
    });
  });
});
