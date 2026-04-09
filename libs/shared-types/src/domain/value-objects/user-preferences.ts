import { NotificationSettings } from './notification-settings';

/**
 * User preferences value object
 */
export class UserPreferences {
  constructor(
    public readonly musicalGenres: string[],
    public readonly notificationSettings: NotificationSettings,
    public readonly searchRadius: number, // in kilometers
    public readonly priceRange?: {
      min: number;
      max: number;
    },
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.searchRadius < 0) {
      throw new Error('Search radius cannot be negative');
    }
    if (this.searchRadius > 1000) {
      throw new Error('Search radius cannot exceed 1000 km');
    }
    if (this.priceRange) {
      if (this.priceRange.min < 0) {
        throw new Error('Minimum price cannot be negative');
      }
      if (this.priceRange.max < this.priceRange.min) {
        throw new Error('Maximum price must be greater than or equal to minimum price');
      }
    }
  }

  /**
   * Add a musical genre
   */
  addGenre(genre: string): UserPreferences {
    const normalizedGenre = genre.trim().toLowerCase();
    if (this.musicalGenres.includes(normalizedGenre)) {
      return this;
    }
    return new UserPreferences(
      [...this.musicalGenres, normalizedGenre],
      this.notificationSettings,
      this.searchRadius,
      this.priceRange,
    );
  }

  /**
   * Remove a musical genre
   */
  removeGenre(genre: string): UserPreferences {
    const normalizedGenre = genre.trim().toLowerCase();
    const updatedGenres = this.musicalGenres.filter(g => g !== normalizedGenre);
    if (updatedGenres.length === this.musicalGenres.length) {
      return this;
    }
    return new UserPreferences(
      updatedGenres,
      this.notificationSettings,
      this.searchRadius,
      this.priceRange,
    );
  }

  /**
   * Update search radius
   */
  withSearchRadius(radius: number): UserPreferences {
    return new UserPreferences(
      this.musicalGenres,
      this.notificationSettings,
      radius,
      this.priceRange,
    );
  }

  /**
   * Update price range
   */
  withPriceRange(min: number, max: number): UserPreferences {
    return new UserPreferences(
      this.musicalGenres,
      this.notificationSettings,
      this.searchRadius,
      { min, max },
    );
  }

  /**
   * Clear price range
   */
  withoutPriceRange(): UserPreferences {
    return new UserPreferences(
      this.musicalGenres,
      this.notificationSettings,
      this.searchRadius,
      undefined,
    );
  }

  /**
   * Update notification settings
   */
  withNotificationSettings(settings: NotificationSettings): UserPreferences {
    return new UserPreferences(
      this.musicalGenres,
      settings,
      this.searchRadius,
      this.priceRange,
    );
  }
}