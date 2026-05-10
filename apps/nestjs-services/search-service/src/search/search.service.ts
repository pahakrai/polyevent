import { Injectable, Logger } from '@nestjs/common';
import { VectorService, SearchFilters } from '../vector/vector.service';

export interface SearchResult {
  id: string;
  title: string;
  category: string;
  genres: string[];
  _score?: number;
  latitude?: number;
  longitude?: number;
  price?: number;
  [key: string]: any;
}

export interface PersonalizedSearchResult extends SearchResult {
  personalization_score: number;
  blended_score: number;
  text_score: number;
  ranking_features: Record<string, unknown>;
}

export interface SearchRequest {
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
  recentEventIds?: string[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly inferenceUrl: string;

  constructor(private readonly vectorService: VectorService) {
    this.inferenceUrl =
      process.env.PYTHON_INFERENCE_URL || 'http://localhost:8000';
  }

  /**
   * Execute a personalized search with pgvector as the primary path.
   *
   * Path A (default): Get user vector (batch or cached) → pgvector cosine search
   * Path B (real-time): User has recent clicks → Python /inference-vector → pgvector
   * Fallback: Elasticsearch → Python /search/personalize
   */
  async search(request: SearchRequest): Promise<PersonalizedSearchResult[]> {
    const topK = request.topK || 20;

    // ── Path B: Real-time inference vector (user has fresh session) ──
    if (request.recentEventIds?.length) {
      try {
        return await this._searchWithInferenceVector(request, topK);
      } catch (error) {
        this.logger.warn(`Path B failed, falling back to Path A: ${error}`);
      }
    }

    // ── Path A: Batch user vector or cached inference vector ──
    try {
      return await this._searchWithBatchVector(request, topK);
    } catch (error) {
      this.logger.warn(`Path A failed, falling back to text search: ${error}`);
    }

    // ── Fallback: Elasticsearch + Python re-ranking ──
    return this._searchFallback(request, topK);
  }

  // ── Path A: Batch user vector ────────────────────────────────────────

  private async _searchWithBatchVector(
    request: SearchRequest,
    topK: number,
  ): Promise<PersonalizedSearchResult[]> {
    // Try Redis-cached inference vector first
    let queryVector: number[] | null = null;
    let vectorSource = 'batch';

    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      const cached = await redis.get(`inference_vector:${request.userId}`);
      if (cached) {
        queryVector = JSON.parse(cached);
        vectorSource = 'cached_session';
      }
      redis.disconnect();
    } catch {
      // Redis not available — skip cache
    }

    // Fall back to batch user vector from pgvector
    if (!queryVector) {
      queryVector = await this.vectorService.getUserEmbedding(request.userId);
    }

    if (!queryVector) {
      // No vector at all — go straight to fallback
      return this._searchFallback(request, topK);
    }

    const filters: SearchFilters = {
      categories: request.categories,
      genres: request.genres,
      maxPrice: request.maxPrice,
      city: undefined,
      lat: request.lat,
      lon: request.lon,
      radiusKm: request.radiusKm,
    };

    const results = await this.vectorService.searchSimilar(
      queryVector,
      filters,
      topK,
    );

    return results.map((r, i) => ({
      id: r.event_id,
      title: r.metadata?.title || r.event_id,
      category: r.metadata?.category || '',
      genres: r.metadata?.genres || [],
      latitude: parseFloat(r.metadata?.latitude || 0),
      longitude: parseFloat(r.metadata?.longitude || 0),
      price: parseFloat(r.metadata?.price || 0),
      _score: r.similarity,
      personalization_score: r.similarity,
      blended_score: r.similarity,
      text_score: r.similarity,
      ranking_features: { vector_source: vectorSource, position: i },
    }));
  }

  // ── Path B: Real-time inference vector ───────────────────────────────

  private async _searchWithInferenceVector(
    request: SearchRequest,
    topK: number,
  ): Promise<PersonalizedSearchResult[]> {
    // Call Python to compute session vector
    const response = await fetch(`${this.inferenceUrl}/inference-vector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: request.userId,
        recent_event_ids: request.recentEventIds,
        alpha: request.alpha ?? 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Python /inference-vector returned ${response.status}`);
    }

    const data = await response.json();
    const queryVector: number[] = data.vector;

    // Cache in Redis (30 min TTL)
    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      await redis.set(
        `inference_vector:${request.userId}`,
        JSON.stringify(queryVector),
        'EX',
        data.ttl_seconds || 1800,
      );
      redis.disconnect();
    } catch {
      // Redis not available — skip caching
    }

    const filters: SearchFilters = {
      categories: request.categories,
      genres: request.genres,
      maxPrice: request.maxPrice,
      lat: request.lat,
      lon: request.lon,
      radiusKm: request.radiusKm,
    };

    const results = await this.vectorService.searchSimilar(
      queryVector,
      filters,
      topK,
    );

    return results.map((r, i) => ({
      id: r.event_id,
      title: r.metadata?.title || r.event_id,
      category: r.metadata?.category || '',
      genres: r.metadata?.genres || [],
      latitude: parseFloat(r.metadata?.latitude || 0),
      longitude: parseFloat(r.metadata?.longitude || 0),
      price: parseFloat(r.metadata?.price || 0),
      _score: r.similarity,
      personalization_score: r.similarity,
      blended_score: r.similarity,
      text_score: r.similarity,
      ranking_features: { vector_source: data.source, position: i },
    }));
  }

  // ── Fallback: Elasticsearch + Python ─────────────────────────────────

  private async _searchFallback(
    request: SearchRequest,
    topK: number,
  ): Promise<PersonalizedSearchResult[]> {
    // Text search via Elasticsearch
    let textResults: SearchResult[] = [];
    try {
      textResults = await this._searchElasticsearch(request, topK * 3);
    } catch (error) {
      this.logger.warn(`Elasticsearch failed: ${error}`);
    }

    if (textResults.length === 0) {
      try {
        textResults = await this._getRecommendations(request, topK * 3);
      } catch {
        return [];
      }
    }

    if (textResults.length === 0) return [];

    // Re-rank via Python
    try {
      return await this._personalizeResults(
        request.userId,
        textResults,
        request.lat,
        request.lon,
        topK,
        request.alpha ?? 0.4,
      );
    } catch (error) {
      this.logger.warn(`Personalization failed: ${error}`);
      return textResults
        .map((r, i) => ({
          ...r,
          personalization_score: 0.5,
          blended_score: r._score || 0.5,
          text_score: r._score || 0.5,
          ranking_features: { fallback: true, position: i },
        }))
        .slice(0, topK);
    }
  }

  private async _searchElasticsearch(
    request: SearchRequest,
    size: number,
  ): Promise<SearchResult[]> {
    try {
      const { ElasticsearchClient } = await import(
        '@polydom/elasticsearch-client'
      );
      const { buildEventSearchQuery } = await import(
        '@polydom/elasticsearch-client/src/queries/event.queries'
      );

      const client = new ElasticsearchClient();
      const query = buildEventSearchQuery({
        query: request.query,
        lat: request.lat,
        lon: request.lon,
        radiusKm: request.radiusKm,
        categories: request.categories,
        genres: request.genres,
        maxPrice: request.maxPrice,
      });

      const response = await client.search('events', {
        ...query,
        size,
        from: 0,
      });

      return (response?.hits?.hits || []).map((hit: any) => ({
        id: hit._id,
        ...(hit._source || {}),
        _score: hit._score,
      }));
    } catch {
      return [];
    }
  }

  private async _getRecommendations(
    request: SearchRequest,
    limit: number,
  ): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      user_id: request.userId,
      top_k: String(limit),
    });
    if (request.lat !== undefined) params.set('lat', String(request.lat));
    if (request.lon !== undefined) params.set('lon', String(request.lon));
    if (request.radiusKm) params.set('radius_km', String(request.radiusKm));
    if (request.categories?.length)
      params.set('categories', request.categories.join(','));
    if (request.genres?.length)
      params.set('genres', request.genres.join(','));
    if (request.maxPrice !== undefined)
      params.set('max_price', String(request.maxPrice));

    const url = `${this.inferenceUrl}/recommendations?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Python returned ${response.status}`);

    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      id: item.event_id,
      title: item.title,
      category: item.category,
      genres: item.genres || [],
      _score: item.relevance_score,
    }));
  }

  private async _personalizeResults(
    userId: string,
    results: SearchResult[],
    lat?: number,
    lon?: number,
    topK: number = 20,
    alpha: number = 0.4,
  ): Promise<PersonalizedSearchResult[]> {
    const body: any = {
      user_id: userId,
      results: results.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        genres: r.genres || [],
        _score: r._score,
        latitude: r.latitude,
        longitude: r.longitude,
        price: r.price,
      })),
      top_k: topK,
      alpha,
    };
    if (lat !== undefined) body.lat = lat;
    if (lon !== undefined) body.lon = lon;

    const response = await fetch(`${this.inferenceUrl}/search/personalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Personalization returned ${response.status}`);

    const data = await response.json();
    return (data.items || []).map((item: any) => {
      const result = results.find((r) => r.id === item.event_id);
      return {
        ...(result || {
          id: item.event_id,
          title: item.title,
          category: item.category,
          genres: item.genres,
        }),
        personalization_score: item.relevance_score,
        blended_score: item.relevance_score,
        text_score: result?._score || 0.5,
        ranking_features: item.explanation || {},
      };
    });
  }
}
