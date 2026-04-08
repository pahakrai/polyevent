# Database Client Library

## Overview
NestJS services for database connections (PostgreSQL, MongoDB, Redis). Provides client wrappers with consistent interface and logging.

## Framework Compatibility
⚠️ **NestJS-coupled** - Requires `@nestjs/common` and uses `@Injectable()` decorator. Designed for use within NestJS applications.

## Exports
- `PostgresClient` - PostgreSQL database client
- `MongoDBClient` - MongoDB database client  
- `RedisClient` - Redis client for caching and sessions

## Usage
```typescript
import { Injectable } from '@nestjs/common';
import { PostgresClient } from '@event-booking-app/database-client';

@Injectable()
export class UserRepository {
  constructor(private readonly db: PostgresClient) {}
  
  async findUserById(id: string) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result[0];
  }
}
```

## Dependencies
- `@nestjs/common` (peer dependency - provided by consuming NestJS application)
- Database drivers (configured via environment variables)

## Database Configuration
### PostgreSQL
- Environment: `DATABASE_URL` or individual connection parameters
- Driver: `pg` or `@neondatabase/serverless`

### MongoDB
- Environment: `MONGODB_URI`
- Driver: `mongoose` or `mongodb`

### Redis
- Environment: `REDIS_URL`
- Driver: `ioredis` or `redis`

## Current Status
🚧 **Stub Implementation** - Currently contains placeholder implementations with TODOs. Actual database connectivity needs to be implemented.

## Implementation Notes
1. Each client should implement connection pooling for production
2. Consider using connection health checks and reconnection logic
3. Environment-specific configurations (development, staging, production)
4. SSL/TLS support for production databases

## Development
```bash
nx build database-client
```