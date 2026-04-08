# Shared Types Library

## Overview
TypeScript interfaces and types shared across the event booking platform. This library contains domain models and DTOs used by multiple services.

## Framework Compatibility
✅ **Framework-agnostic** - No dependencies on NestJS or any other framework. Can be used in any TypeScript project.

## Exports
- `User`, `UserRole`, `UserPreferences`, `UserActivity` - User domain models
- `Event`, `EventType`, `EventStatus` - Event domain models  
- `Vendor`, `VendorStatus` - Vendor domain models
- `Booking`, `BookingStatus`, `TicketType` - Booking domain models
- `Auth`, `JwtPayload`, `LoginResponse` - Authentication types

## Usage
```typescript
import { User, UserRole } from '@event-booking-app/shared-types';

const user: User = {
  id: '123',
  email: 'user@example.com',
  name: 'John Doe',
  role: 'user' as UserRole,
  // ...
};
```

## Dependencies
- None (pure TypeScript types)

## Development
This library is built as part of the NX monorepo. To rebuild:
```bash
nx build shared-types
```