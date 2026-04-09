import { Entity } from './entity';
import { UserRole } from '../value-objects/user-role';
import { UserPreferences } from '../value-objects/user-preferences';
import { Location } from '../value-objects/location';

/**
 * User domain entity
 */
export class User extends Entity<string> {
  private _email: string;
  private _name: string;
  private _role: UserRole;
  private _preferences: UserPreferences;
  private _location?: Location;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(
    id: string,
    email: string,
    name: string,
    role: UserRole,
    preferences: UserPreferences,
    createdAt: Date,
    updatedAt: Date,
    location?: Location,
  ) {
    super(id);
    this._email = email;
    this._name = name;
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

  get name(): string {
    return this._name;
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
   * Update user email with validation
   */
  updateEmail(newEmail: string): void {
    this.validateEmail(newEmail);
    this._email = newEmail;
    this._updatedAt = new Date();
  }

  /**
   * Update user name
   */
  updateName(newName: string): void {
    this.validateName(newName);
    this._name = newName;
    this._updatedAt = new Date();
  }

  /**
   * Change user role (with business rules)
   */
  changeRole(newRole: UserRole): void {
    // Add business rules here, e.g., only admins can change roles
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
    this.validateName(this._name);
    // Additional validations can be added here
  }

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address');
    }
  }

  private validateName(name: string): void {
    if (!name.trim()) {
      throw new Error('Name cannot be empty');
    }
    if (name.length > 100) {
      throw new Error('Name cannot exceed 100 characters');
    }
  }
}