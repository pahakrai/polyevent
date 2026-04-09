/**
 * Database adapter interface for low-level database operations
 */
export interface DatabaseAdapter {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Check if connection is alive
   */
  isConnected(): boolean;

  /**
   * Start a transaction
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit the current transaction
   */
  commitTransaction(): Promise<void>;

  /**
   * Rollback the current transaction
   */
  rollbackTransaction(): Promise<void>;

  /**
   * Execute a raw query (for advanced use cases)
   */
  executeQuery<T = any>(sql: string, params?: any[]): Promise<T[]>;

  /**
   * Get database-specific client (e.g., Drizzle, Mongoose)
   */
  getClient(): any;
}