import { Controller, Post, Body, Logger } from '@nestjs/common';
import { SearchService, PersonalizedSearchResult } from './search.service';

class SearchRequestDto {
  query: string;
  userId: string;
  lat?: number;
  lon?: number;
  radiusKm?: number;
  categories?: string[];
  genres?: string[];
  maxPrice?: number;
  topK?: number;
  alpha?: number;
}

@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly searchService: SearchService) {}

  @Post()
  async search(@Body() dto: SearchRequestDto): Promise<{
    results: PersonalizedSearchResult[];
    total: number;
  }> {
    this.logger.log(
      `Search: query="${dto.query}", user=${dto.userId}, alpha=${dto.alpha ?? 0.4}`,
    );

    const results = await this.searchService.search({
      query: dto.query,
      userId: dto.userId,
      lat: dto.lat,
      lon: dto.lon,
      radiusKm: dto.radiusKm,
      categories: dto.categories,
      genres: dto.genres,
      maxPrice: dto.maxPrice,
      topK: dto.topK,
      alpha: dto.alpha,
    });

    return { results, total: results.length };
  }
}
