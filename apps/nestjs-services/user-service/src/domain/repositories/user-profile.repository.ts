import { Repository } from '@polydom/shared-types';
import { UserProfile } from '../entities/user-profile.entity';
import { UserRole } from '@polydom/shared-types';

/**
 * UserProfile repository interface with domain-specific queries
 */
export interface UserProfileRepository extends Repository<UserProfile, string> {
  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<UserProfile | null>;

  /**
   * Find users by role
   */
  findByRole(role: UserRole): Promise<UserProfile[]>;

  /**
   * Find users within location radius
   */
  findNearLocation(location: any, radiusKm: number): Promise<UserProfile[]>;

  /**
   * Check if email is already registered
   */
  emailExists(email: string): Promise<boolean>;

  /**
   * Find users by musical genre preference
   */
  findByMusicalGenre(genre: string): Promise<UserProfile[]>;

  /**
   * Find users by phone number
   */
  findByPhone(phone: string): Promise<UserProfile | null>;
}