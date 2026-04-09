import { Repository } from './base.repository';
import { User } from '../entities/user.entity';
import { UserRole } from '../value-objects/user-role';

/**
 * User repository interface with domain-specific queries
 */
export interface UserRepository extends Repository<User, string> {
  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find users by role
   */
  findByRole(role: UserRole): Promise<User[]>;

  /**
   * Find users within location radius
   */
  findNearLocation(location: any, radiusKm: number): Promise<User[]>;

  /**
   * Check if email is already registered
   */
  emailExists(email: string): Promise<boolean>;

  /**
   * Find users by musical genre preference
   */
  findByMusicalGenre(genre: string): Promise<User[]>;
}