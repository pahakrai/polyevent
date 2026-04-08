export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  preferences: UserPreferences;
  location?: Location;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'user' | 'vendor' | 'admin';

export interface UserPreferences {
  musicalGenres: string[];
  notificationSettings: NotificationSettings;
  searchRadius: number; // in kilometers
  priceRange?: {
    min: number;
    max: number;
  };
}

export interface NotificationSettings {
  email: boolean;
  sms: boolean;
  push: boolean;
  marketingEmails: boolean;
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  city: string;
  country: string;
}

export interface UserActivity {
  userId: string;
  type: ActivityType;
  timestamp: Date;
  metadata: Record<string, any>;
}

export type ActivityType =
  | 'page_view'
  | 'search'
  | 'event_view'
  | 'booking'
  | 'login'
  | 'logout'
  | 'profile_update';