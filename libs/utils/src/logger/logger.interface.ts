/**
 * Framework-agnostic logger interface.
 * Can be implemented for any logging framework or environment.
 */
export interface Logger {
  /**
   * Log a message with optional context
   */
  log(message: string, context?: string): void;

  /**
   * Log an error with optional trace and context
   */
  error(message: string, trace?: string, context?: string): void;

  /**
   * Log a warning with optional context
   */
  warn(message: string, context?: string): void;

  /**
   * Log a debug message with optional context
   */
  debug?(message: string, context?: string): void;

  /**
   * Log a verbose message with optional context
   */
  verbose?(message: string, context?: string): void;

  /**
   * Set logger context (for contextual logging)
   */
  setContext?(context: string): void;
}