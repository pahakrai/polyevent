import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { Logger } from './logger.interface';

/**
 * NestJS adapter for the framework-agnostic Logger interface.
 * Wraps a NestJS LoggerService to provide consistent logging API.
 */
@Injectable()
export class NestLoggerAdapter implements Logger {
  private context?: string;

  constructor(private readonly nestLogger: NestLoggerService) {}

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: string): void {
    const logContext = context || this.context;
    this.nestLogger.log(message, logContext);
  }

  error(message: string, trace?: string, context?: string): void {
    const logContext = context || this.context;
    this.nestLogger.error(message, trace, logContext);
  }

  warn(message: string, context?: string): void {
    const logContext = context || this.context;
    this.nestLogger.warn(message, logContext);
  }

  debug(message: string, context?: string): void {
    const logContext = context || this.context;
    if (this.nestLogger.debug) {
      this.nestLogger.debug(message, logContext);
    } else {
      // Fallback to log if debug not implemented
      this.nestLogger.log(`[DEBUG] ${message}`, logContext);
    }
  }

  verbose(message: string, context?: string): void {
    const logContext = context || this.context;
    if (this.nestLogger.verbose) {
      this.nestLogger.verbose(message, logContext);
    } else {
      // Fallback to log if verbose not implemented
      this.nestLogger.log(`[VERBOSE] ${message}`, logContext);
    }
  }
}