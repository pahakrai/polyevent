// Permission string format: "resource:action" e.g., "vendor:write", "event:read"
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  USER: [
    'profile:read',
    'profile:write',
    'event:read',
    'booking:create',
    'booking:read',
  ],
  VENDOR: [
    'profile:read',
    'profile:write',
    'vendor:read',
    'vendor:write',
    'venue:create',
    'venue:read',
    'venue:write',
    'venue:delete',
    'timeslot:create',
    'timeslot:read',
    'timeslot:write',
    'timeslot:delete',
    'event:create',
    'event:read',
    'event:write',
    'booking:read',
  ],
  ADMIN: ['*:*'],
};

export interface VendorRegistrationFields {
  businessName: string;
  description?: string;
  category: string;
  subCategory?: string;
  contactEmail: string;
  contactPhone: string;
  website?: string;
  address: Record<string, any>;
  location: Record<string, any>;
  coverImage?: string;
}
