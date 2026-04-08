import { Logger } from './logger.interface';

/**
 * Framework-agnostic console logger.
 * Uses browser/Node.js console API with structured formatting.
 */
export class ConsoleLogger implements Logger {
  private context?: string;

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: string): void {
    const logContext = context || this.context;
    const prefix = this.formatPrefix('INFO', logContext);
    console.log(prefix + message);
  }

  error(message: string, trace?: string, context?: string): void {
    const logContext = context || this.context;
    const prefix = this.formatPrefix('ERROR', logContext);
    console.error(prefix + message);
    if (trace) {
      console.error(trace);
    }
  }

  warn(message: string, context?: string): void {
    const logContext = context || this.context;
    const prefix = this.formatPrefix('WARN', logContext);
    console.warn(prefix + message);
  }

  debug(message: string, context?: string): void {
    const logContext = context || this.context;
    const prefix = this.formatPrefix('DEBUG', logContext);
    console.debug(prefix + message);
  }

  verbose(message: string, context?: string): void {
    const logContext = context || this.context;
    const prefix = this.formatPrefix('VERBOSE', logContext);
    console.log(prefix + message);
  }

  private formatPrefix(level: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const contextPart = context ? ` [${context}]` : '';
    return `[${level}] ${timestamp}${contextPart} `;
  }
}