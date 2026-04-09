/**
 * Base entity class with common properties and methods
 */
export abstract class Entity<T> {
  protected readonly _id: T;

  constructor(id: T) {
    this._id = id;
  }

  get id(): T {
    return this._id;
  }

  /**
   * Equality comparison based on identity
   */
  equals(other: Entity<T>): boolean {
    if (other === null || other === undefined) return false;
    if (this === other) return true;
    return this._id === other._id;
  }

  /**
   * Hash code for identity-based collections
   */
  hashCode(): string {
    return String(this._id);
  }
}