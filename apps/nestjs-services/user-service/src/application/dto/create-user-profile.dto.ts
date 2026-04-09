import { UserRole, UserPreferences, Location } from '@polydom/shared-types';

export class CreateUserProfileDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  preferences: UserPreferences;
  location?: Location;
}