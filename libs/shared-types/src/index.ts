// Legacy interfaces (type-only)
export type { User } from './user.interface';
export type { UserActivity, ActivityType } from './user.interface';
export type { Event, EventStatus, EventType, EventLocation, EventSchedule, RecurrencePattern, Pricing, EventSearchFilters } from './event.interface';
export type { Vendor } from './vendor.interface';
export type { Booking, BookingStatus } from './booking.interface';
export type { LoginRequest, LoginResponse, RegisterRequest, AuthUser } from './auth.interface';

// Domain layer (value exports for enums/classes)
export { Entity } from './domain';
export { UserRole } from './domain';
export { Location } from './domain';
export { NotificationSettings } from './domain';
export { UserPreferences } from './domain';

// Repository interfaces (type-only)
export type { Repository } from './domain';
export type { UserRepository } from './domain';

// Persistence layer interfaces (type-only)
export type { DatabaseAdapter } from './persistence';
export type { RepositoryFactory } from './persistence';
export type { DatabaseConfig } from './persistence';