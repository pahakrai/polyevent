import { UserProfileRepository } from './user-profile.repository';

/**
 * Factory for creating UserProfileRepository instances
 */
export interface UserProfileRepositoryFactory {
  createUserProfileRepository(): UserProfileRepository;
}