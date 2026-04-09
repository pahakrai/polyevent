import { Entity } from '@polydom/shared-types';
import { UserRole } from '@polydom/shared-types';
import { UserPreferences } from '@polydom/shared-types';
import { Location } from '@polydom/shared-types';

/**
 * UserProfile domain entity
 */
export class UserProfile extends Entity<string> {
  private _email: string;
  private _firstName: string;
  private _lastName: string;
  private _phone?: string;
  private _role: UserRole;
  private _preferences: UserPreferences;
  private _location?: Location;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(
    id: string,
    email: string,
    firstName: string,
    lastName: string,
    role: UserRole,
    preferences: UserPreferences,
    createdAt: Date,
    updatedAt: Date,
    location?: Location,
    phone?: string,
  ) {
    super(id);
    this._email = email;
    this._firstName = firstName;
    this._lastName = lastName;
    this._phone = phone;
    this._role = role;
    this._preferences = preferences;
    this._location = location;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this.validate();
  }

  get email(): string {
    return this._email;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get fullName(): string {
    return `${this._firstName} ${this._lastName}`;
  }

  get phone(): string | undefined {
    return this._phone;
  }

  get role(): UserRole {
    return this._role;
  }

  get preferences(): UserPreferences {
    return this._preferences;
  }

  get location(): Location | undefined {
    return this._location;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Update email with validation
   */
  updateEmail(newEmail: string): void {
    this.validateEmail(newEmail);
    this._email = newEmail;
    this._updatedAt = new Date();
  }

  /**
   * Update first name
   */
  updateFirstName(newFirstName: string): void {
    this.validateNamePart(newFirstName, 'First name');
    this._firstName = newFirstName;
    this._updatedAt = new Date();
  }

  /**
   * Update last name
   */
  updateLastName(newLastName: string): void {
    this.validateNamePart(newLastName, 'Last name');
    this._lastName = newLastName;
    this._updatedAt = new Date();
  }

  /**
   * Update phone number
   */
  updatePhone(newPhone?: string): void {
    if (newPhone) {
      this.validatePhone(newPhone);
    }
    this._phone = newPhone;
    this._updatedAt = new Date();
  }

  /**
   * Change user role (with business rules)
   */
  changeRole(newRole: UserRole): void {
    // Add business rules here
    this._role = newRole;
    this._updatedAt = new Date();
  }

  /**
   * Update user preferences
   */
  updatePreferences(newPreferences: UserPreferences): void {
    this._preferences = newPreferences;
    this._updatedAt = new Date();
  }

  /**
   * Update user location
   */
  updateLocation(newLocation?: Location): void {
    this._location = newLocation;
    this._updatedAt = new Date();
  }

  /**
   * Check if user can perform admin actions
   */
  isAdmin(): boolean {
    return this._role === UserRole.ADMIN;
  }

  /**
   * Check if user is a vendor
   */
  isVendor(): boolean {
    return this._role === UserRole.VENDOR;
  }

  /**
   * Check if user is a regular user
   */
  isRegularUser(): boolean {
    return this._role === UserRole.USER;
  }

  /**
   * Validate entity state
   */
  private validate(): void {
    this.validateEmail(this._email);
    this.validateNamePart(this._firstName, 'First name');
    this.validateNamePart(this._lastName, 'Last name');
    if (this._phone) {
      this.validatePhone(this._phone);
    }
    // Additional validations can be added here
  }

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address');
    }
  }

  private validateNamePart(namePart: string, fieldName: string): void {
    if (!namePart.trim()) {
      throw new Error(`${fieldName} cannot be empty`);
    }
    if (namePart.length > 50) {
      throw new Error(`${fieldName} cannot exceed 50 characters`);
    }
  }

  private validatePhone(phone: string): void {
    // Simple validation - can be enhanced with library
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
      throw new Error('Invalid phone number format');
    }
  }
}