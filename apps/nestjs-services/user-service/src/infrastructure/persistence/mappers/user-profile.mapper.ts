import { UserProfile } from '../../../domain/entities/user-profile.entity';
import { UserRole, UserPreferences, Location } from '@polydom/shared-types';
import { User as DrizzleUser } from '../../../../database/schema';

/**
 * Maps between Drizzle schema types and UserProfile domain entity
 */
export class UserProfileMapper {
  /**
   * Convert Drizzle User to UserProfile domain entity
   */
  static toDomain(drizzleUser: DrizzleUser): UserProfile {
    // Parse JSON fields
    const location = drizzleUser.location ? this.parseLocation(drizzleUser.location) : undefined;
    const preferences = this.parsePreferences(drizzleUser.preferences);

    // Map role string to UserRole enum
    const role = this.mapRole(drizzleUser.role);

    return new UserProfile(
      drizzleUser.id,
      drizzleUser.email,
      drizzleUser.firstName,
      drizzleUser.lastName,
      role,
      preferences,
      drizzleUser.createdAt,
      drizzleUser.updatedAt,
      location,
      drizzleUser.phone ?? undefined,
    );
  }

  /**
   * Convert UserProfile domain entity to Drizzle User insert/update object
   */
  static toPersistence(userProfile: UserProfile): Partial<DrizzleUser> {
    return {
      id: userProfile.id,
      email: userProfile.email,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      phone: userProfile.phone ?? null,
      role: userProfile.role,
      location: userProfile.location ? JSON.stringify(userProfile.location) : null,
      preferences: JSON.stringify(userProfile.preferences),
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt,
    };
  }

  /**
   * Parse location JSON
   */
  private static parseLocation(location: any): Location {
    if (typeof location === 'string') {
      return JSON.parse(location);
    }
    return location as Location;
  }

  /**
   * Parse preferences JSON
   */
  private static parsePreferences(preferences: any): UserPreferences {
    if (typeof preferences === 'string') {
      return JSON.parse(preferences);
    }
    return preferences as UserPreferences;
  }

  /**
   * Map role string to UserRole enum
   */
  private static mapRole(role: string): UserRole {
    switch (role) {
      case 'USER':
        return UserRole.USER;
      case 'VENDOR':
        return UserRole.VENDOR;
      case 'ADMIN':
        return UserRole.ADMIN;
      default:
        // Fallback to USER if unknown
        return UserRole.USER;
    }
  }
}