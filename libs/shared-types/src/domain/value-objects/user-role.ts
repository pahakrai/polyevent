/**
 * User role value object
 */
export enum UserRole {
  USER = 'user',
  VENDOR = 'vendor',
  ADMIN = 'admin',
}

/**
 * Check if a role has admin privileges
 */
export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

/**
 * Check if a role has vendor privileges
 */
export function isVendor(role: UserRole): boolean {
  return role === UserRole.VENDOR;
}

/**
 * Check if a role is a regular user
 */
export function isRegularUser(role: UserRole): boolean {
  return role === UserRole.USER;
}