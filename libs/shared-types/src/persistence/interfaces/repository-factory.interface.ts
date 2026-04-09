import { UserRepository } from '../../domain/repositories/user.repository';
// Import other repository interfaces as they are defined

/**
 * Factory for creating repository instances
 */
export interface RepositoryFactory {
  /**
   * Create user repository
   */
  createUserRepository(): UserRepository;

  // Add methods for other repositories
  // createEventRepository(): EventRepository;
  // createVendorRepository(): VendorRepository;
  // createBookingRepository(): BookingRepository;
}