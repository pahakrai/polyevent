// Domain entities
export { Entity } from './entities/entity';
export { User } from './entities/user.entity';

// Value objects
export { UserRole } from './value-objects/user-role';
export { Location } from './value-objects/location';
export { NotificationSettings } from './value-objects/notification-settings';
export { UserPreferences } from './value-objects/user-preferences';

// Repository interfaces
export type { Repository } from './repositories/base.repository';
export type { UserRepository } from './repositories/user.repository';