// Legacy interfaces (type-only)
export type { User } from './user.interface';
export type { UserActivity, ActivityType } from './user.interface';
export type { Event, EventStatus, EventType, EventLocation, EventSchedule, RecurrencePattern, Pricing, EventSearchFilters } from './event.interface';
export type { Vendor, VendorCategory, VendorPricingModel } from './vendor.interface';
export type { Booking, BookingStatus } from './booking.interface';
export type { LoginRequest, LoginResponse, RegisterRequest, AuthUser } from './auth.interface';

// New domain interfaces
export type { Venue, VenueType, VenuePricingModel, VenueAddress, VenueCoordinates } from './venue.interface';
export type { TimeSlot, TimeSlotStatus, CreateTimeSlotRequest, BulkCreateTimeSlotRequest } from './timeslot.interface';
export type { Group, GroupMember, GroupMemberRole, CreateGroupRequest, UpdateGroupRequest } from './group.interface';

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