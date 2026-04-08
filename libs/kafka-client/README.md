# Kafka Client Library

## Overview
NestJS services for Kafka message production and consumption. Provides base classes for creating Kafka producers and consumers with standardized configuration.

## Framework Compatibility
⚠️ **NestJS-coupled** - Requires `@nestjs/common` and uses `@Injectable()` decorator. Designed for use within NestJS applications.

## Exports
- `BaseProducer` - Abstract base class for Kafka producers
- `BaseConsumer` - Abstract base class for Kafka consumers  
- `UserActivityMessage` - Interface for user activity events
- `USER_ACTIVITY_TOPIC` - Constant for user activity topic name

## Usage
```typescript
import { Injectable } from '@nestjs/common';
import { BaseProducer } from '@event-booking-app/kafka-client';

@Injectable()
export class UserActivityProducer extends BaseProducer {
  async publishUserActivity(activity: UserActivityMessage) {
    await this.send(USER_ACTIVITY_TOPIC, activity);
  }
}
```

## Dependencies
- `@nestjs/common` (peer dependency - provided by consuming NestJS application)
- Kafka broker connection (configured via environment variables)

## Current Status
🚧 **Stub Implementation** - Currently contains placeholder implementations with TODOs. Actual Kafka connectivity needs to be implemented.

## Implementation Notes
1. Extend `BaseProducer` or `BaseConsumer` for specific topics
2. Configure Kafka connection via environment variables:
   - `KAFKA_BROKERS`: Comma-separated broker addresses
   - `KAFKA_CLIENT_ID`: Client identifier
3. Implement `connect()` and `disconnect()` methods for actual Kafka client

## Development
```bash
nx build kafka-client
```