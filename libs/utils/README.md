# Utilities Library

## Overview
Shared utilities including logging, validation, and data transformation. Contains both framework-agnostic utilities and NestJS-coupled services.

## Framework Compatibility
⚠️ **Mixed** - Some utilities are framework-agnostic, while others are NestJS-coupled.

### Framework-agnostic ✅
- `IsValidEmailConstraint` - Email validator using `class-validator`
- `TransformDate`, `FormatDate`, `GetTimeAgo` - Date utilities using `class-transformer`

### NestJS-coupled ⚠️  
- `CustomLogger` - Implements NestJS `LoggerService` interface with `@Injectable()`

## Exports
### Logging
- `CustomLogger` - NestJS logger service with structured logging

### Validation
- `IsValidEmailConstraint` - Comprehensive email validator

### Date Transformation
- `TransformDate()` - Class transformer for date fields
- `FormatDate()` - Date formatting utility
- `GetTimeAgo()` - Human-readable time difference

## Usage
### NestJS Service (Coupled)
```typescript
import { Injectable } from '@nestjs/common';
import { CustomLogger } from '@event-booking-app/utils';

@Injectable()
export class UserService {
  private readonly logger = new CustomLogger();
  
  constructor() {
    this.logger.setContext(UserService.name);
  }
  
  async createUser() {
    this.logger.log('Creating user...');
  }
}
```

### Framework-agnostic Usage
```typescript
import { IsValidEmailConstraint } from '@event-booking-app/utils';
import { validate } from 'class-validator';

const validator = new IsValidEmailConstraint();
const isValid = validator.validate('test@example.com', {} as any);
```

## Dependencies
### Framework-agnostic
- `class-validator` - For validation utilities
- `class-transformer` - For data transformation

### NestJS-coupled  
- `@nestjs/common` (peer dependency for `CustomLogger` only)

## Refactoring Consideration
The `CustomLogger` is currently tightly coupled to NestJS. Consider implementing adapter pattern:

```typescript
// Framework-agnostic interface
interface Logger {
  log(message: string): void;
}

// Framework-agnostic implementation  
class ConsoleLogger implements Logger { /* ... */ }

// NestJS adapter
@Injectable()
class NestLoggerAdapter implements Logger { /* ... */ }
```

## Current Status
✅ **Partially Implemented** - Validators and transformers are complete. Logger is a stub.

## Development
```bash
nx build utils
```