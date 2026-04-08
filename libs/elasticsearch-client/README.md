# Elasticsearch Client Library

## Overview
Elasticsearch utilities for event search and indexing. Contains client wrapper, index mappings, and query builders.

## Framework Compatibility
⚠️ **Mixed** - The `ElasticsearchClient` is NestJS-coupled (uses `@Injectable()`), while index mappings and query builders are framework-agnostic.

## Exports
### NestJS-coupled
- `ElasticsearchClient` - Main client wrapper with `@Injectable()` decorator

### Framework-agnostic
- `EVENT_INDEX_MAPPING` - Elasticsearch index configuration for events
- `EVENT_INDEX_NAME` - Constant for event index name
- `buildEventSearchQuery()` - Query builder function for event search

## Usage
### NestJS Service
```typescript
import { Injectable } from '@nestjs/common';
import { ElasticsearchClient } from '@event-booking-app/elasticsearch-client';

@Injectable()
export class SearchService {
  constructor(private readonly esClient: ElasticsearchClient) {}
  
  async searchEvents(filters: any) {
    const query = buildEventSearchQuery(filters);
    return await this.esClient.search(EVENT_INDEX_NAME, query);
  }
}
```

### Framework-agnostic Usage
```typescript
import { buildEventSearchQuery, EVENT_INDEX_MAPPING } from '@event-booking-app/elasticsearch-client';

// Can be used outside NestJS
const query = buildEventSearchQuery({
  query: 'jazz concert',
  location: { latitude: 40.7128, longitude: -74.0060, radius: 10 },
  page: 1,
  limit: 20
});
```

## Dependencies
- `@nestjs/common` (peer dependency for `ElasticsearchClient` only)
- `@elastic/elasticsearch` (to be added)
- Elasticsearch cluster connection

## Current Status
🚧 **Stub Implementation** - `ElasticsearchClient` is a placeholder. Index mappings and query builders are implemented.

## Implementation Notes
1. `ElasticsearchClient` needs actual `@elastic/elasticsearch` integration
2. Consider connection pooling and retry logic
3. Index management (creation, updates, aliases)
4. Search query optimization for performance

## Environment Configuration
- `ELASTICSEARCH_HOSTS`: Comma-separated node URLs
- `ELASTICSEARCH_USERNAME`: Basic auth username (optional)
- `ELASTICSEARCH_PASSWORD`: Basic auth password (optional)
- `ELASTICSEARCH_SSL`: Enable/disable SSL (default: true for production)

## Development
```bash
nx build elasticsearch-client
```