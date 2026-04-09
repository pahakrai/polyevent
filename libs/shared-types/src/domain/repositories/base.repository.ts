/**
 * Generic repository interface for CRUD operations
 */
export interface Repository<T, ID> {
  /**
   * Find entity by its identifier
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Find all entities
   */
  findAll(): Promise<T[]>;

  /**
   * Find entities matching criteria
   */
  find(criteria: Partial<T>): Promise<T[]>;

  /**
   * Create a new entity
   */
  create(entity: T): Promise<T>;

  /**
   * Update an existing entity
   */
  update(id: ID, entity: Partial<T>): Promise<T>;

  /**
   * Delete an entity
   */
  delete(id: ID): Promise<void>;

  /**
   * Check if entity exists
   */
  exists(id: ID): Promise<boolean>;

  /**
   * Count entities matching criteria
   */
  count(criteria?: Partial<T>): Promise<number>;
}