/**
 * Location value object (immutable)
 */
export class Location {
  constructor(
    public readonly latitude: number,
    public readonly longitude: number,
    public readonly city: string,
    public readonly country: string,
    public readonly address?: string,
  ) {
    this.validate();
  }

  /**
   * Validate location coordinates
   */
  private validate(): void {
    if (this.latitude < -90 || this.latitude > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (this.longitude < -180 || this.longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
    if (!this.city.trim()) {
      throw new Error('City is required');
    }
    if (!this.country.trim()) {
      throw new Error('Country is required');
    }
  }

  /**
   * Calculate distance to another location (Haversine formula)
   */
  distanceTo(other: Location): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.degreesToRadians(other.latitude - this.latitude);
    const dLon = this.degreesToRadians(other.longitude - this.longitude);
    const lat1 = this.degreesToRadians(this.latitude);
    const lat2 = this.degreesToRadians(other.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if location is within radius of another location
   */
  isWithinRadius(other: Location, radiusKm: number): boolean {
    return this.distanceTo(other) <= radiusKm;
  }

  /**
   * Create a new location with updated address
   */
  withAddress(address: string): Location {
    return new Location(
      this.latitude,
      this.longitude,
      this.city,
      this.country,
      address,
    );
  }
}