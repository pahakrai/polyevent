/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  /**
   * Database type
   */
  type: 'postgres' | 'mongodb';

  /**
   * Database host
   */
  host: string;

  /**
   * Database port
   */
  port: number;

  /**
   * Database name
   */
  database: string;

  /**
   * Username (optional for some databases)
   */
  username?: string;

  /**
   * Password (optional for some databases)
   */
  password?: string;

  /**
   * Connection pool settings
   */
  pool?: {
    min?: number;
    max?: number;
    idleTimeout?: number;
  };

  /**
   * SSL configuration
   */
  ssl?: boolean | { rejectUnauthorized: boolean };

  /**
   * PostgreSQL-specific options
   */
  postgres?: {
    schema?: string;
    sslMode?: 'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
  };

  /**
   * MongoDB-specific options
   */
  mongodb?: {
    authSource?: string;
    replicaSet?: string;
    directConnection?: boolean;
  };
}