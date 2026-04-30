export interface Venue {
  id: string;
  vendorId: string;
  name: string;
  description?: string;
  type: VenueType;
  capacity: number;
  address: VenueAddress;
  location: VenueCoordinates;
  amenities: string[];
  images: string[];
  pricingModel: VenuePricingModel;
  hourlyRate?: number;
  isAvailable: boolean;
  createdAt: string;
}

export type VenueType = 'indoor' | 'outdoor' | 'studio' | 'gallery' | 'field' | 'court' | 'other';

export type VenuePricingModel = 'free' | 'per_hour' | 'contract' | 'mixed';

export interface VenueAddress {
  street: string;
  city: string;
  region: string;
  country: string;
  postalCode?: string;
}

export interface VenueCoordinates {
  latitude: number;
  longitude: number;
}
