import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

export interface VectorSearchResult {
  event_id: string;
  metadata: Record<string, any>;
  similarity: number;
}

export interface SearchFilters {
  categories?: string[];
  genres?: string[];
  maxPrice?: number;
  city?: string;
  lat?: number;
  lon?: number;
  radiusKm?: number;
}

@Injectable()
export class VectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VectorService.name);
  private pool: any = null;
  private pg: any;

  async onModuleInit() {
    try {
      this.pg = require('pg');
      const connectionString =
        process.env.VECTOR_DATABASE_URL ||
        'postgresql://eventbooking:eventbooking123@localhost:5432/vector_db';

      this.pool = new this.pg.Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const client = await this.pool.connect();
      client.release();
      this.logger.log('Connected to pgvector');
    } catch (error) {
      this.logger.warn(
        'pgvector connection failed — vector search will fall back to text-only',
        error,
      );
      this.pool = null;
    }
  }

  get isConnected(): boolean {
    return this.pool !== null;
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  private formatVector(arr: number[]): string {
    return `[${arr.map((v) => v.toFixed(10)).join(',')}]`;
  }

  private parseVector(s: string): number[] {
    return s
      .slice(1, -1)
      .split(',')
      .map(Number);
  }

  // ── Vector search ───────────────────────────────────────────────────

  async searchSimilar(
    embedding: number[],
    filters: SearchFilters = {},
    limit: number = 50,
  ): Promise<VectorSearchResult[]> {
    if (!this.pool) {
      this.logger.warn('pgvector not available, returning empty results');
      return [];
    }

    const vecStr = this.formatVector(embedding);
    const conditions: string[] = ["metadata->>'status' = 'PUBLISHED'"];
    const params: any[] = [vecStr];
    let paramIdx = 2;

    if (filters.categories?.length) {
      conditions.push(
        `metadata->>'category' = ANY($${paramIdx++}::text[])`,
      );
      params.push(filters.categories);
    }

    if (filters.genres?.length) {
      conditions.push(
        `metadata->'genres' ?| $${paramIdx++}::text[]`,
      );
      params.push(filters.genres);
    }

    if (filters.maxPrice != null) {
      conditions.push(`(metadata->>'price')::float <= $${paramIdx++}`);
      params.push(filters.maxPrice);
    }

    if (filters.city) {
      conditions.push(`metadata->>'city' = $${paramIdx++}`);
      params.push(filters.city);
    }

    // Geo bounding-box pre-filter
    if (filters.lat != null && filters.lon != null && filters.radiusKm) {
      const dlat = filters.radiusKm / 111.0;
      const dlon =
        filters.radiusKm /
        (111.0 * Math.cos((filters.lat * Math.PI) / 180) + 1e-8);
      conditions.push(
        `(metadata->>'latitude')::float BETWEEN $${paramIdx++} AND $${paramIdx++}`,
      );
      params.push(filters.lat - dlat, filters.lat + dlon);
      conditions.push(
        `(metadata->>'longitude')::float BETWEEN $${paramIdx++} AND $${paramIdx++}`,
      );
      params.push(filters.lon - dlon, filters.lon + dlon);
    }

    const whereClause = conditions.join(' AND ');
    const fetchLimit = filters.lat != null ? limit * 3 : limit;

    const sql = `
      SELECT event_id, metadata,
             1 - (embedding <=> $1::vector) AS similarity
      FROM event_embeddings
      WHERE ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $${paramIdx++}
    `;
    params.push(fetchLimit);

    const result = await this.pool.query(sql, params);

    // Post-filter: exact haversine check
    let rows = result.rows;
    if (filters.lat != null && filters.lon != null && filters.radiusKm) {
      rows = rows.filter((row: any) => {
        const meta = row.metadata;
        const dist = this.haversine(
          filters.lat!,
          filters.lon!,
          parseFloat(meta.latitude || 0),
          parseFloat(meta.longitude || 0),
        );
        return dist <= filters.radiusKm!;
      });
    }

    return rows.slice(0, limit).map((row: any) => ({
      event_id: row.event_id,
      metadata: row.metadata,
      similarity: parseFloat(row.similarity),
    }));
  }

  // ── Embedding lookups ────────────────────────────────────────────────

  async getEventEmbedding(eventId: string): Promise<number[] | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT embedding FROM event_embeddings WHERE event_id = $1',
      [eventId],
    );
    if (result.rows.length === 0) return null;
    return this.parseVector(result.rows[0].embedding);
  }

  async getUserEmbedding(userId: string): Promise<number[] | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT embedding FROM user_embeddings WHERE user_id = $1',
      [userId],
    );
    if (result.rows.length === 0) return null;
    return this.parseVector(result.rows[0].embedding);
  }

  async getEventEmbeddingsBatch(
    eventIds: string[],
  ): Promise<Record<string, number[]>> {
    if (!this.pool || eventIds.length === 0) return {};
    const result = await this.pool.query(
      'SELECT event_id, embedding FROM event_embeddings WHERE event_id = ANY($1::text[])',
      [eventIds],
    );
    const map: Record<string, number[]> = {};
    for (const row of result.rows) {
      map[row.event_id] = this.parseVector(row.embedding);
    }
    return map;
  }

  // ── Utility ──────────────────────────────────────────────────────────

  private haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }
}
