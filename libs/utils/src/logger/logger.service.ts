import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConsoleLogger } from './console.logger';

/**
 * CustomLogger - Default logger implementation for the utils library.
 *
 * Extends ConsoleLogger (framework-agnostic) and implements NestLoggerService.
 * Can be used as both a framework-agnostic logger and a NestJS logger.
 *
 * @deprecated For new code, prefer using the Logger interface with either
 * ConsoleLogger (framework-agnostic) or NestLoggerAdapter (NestJS integration).
 * This class is maintained for backward compatibility.
 */
@Injectable()
export class CustomLogger extends ConsoleLogger implements NestLoggerService {
  // Override NestLoggerService methods with proper signature mapping

  log(message: any, ...optionalParams: any[]): void {
    const messageStr = this.stringifyMessage(message);
    const context = this.extractContext(optionalParams);
    super.log(messageStr, context);
  }

  error(message: any, ...optionalParams: any[]): void {
    const messageStr = this.stringifyMessage(message);
    const context = this.extractContext(optionalParams);
    const trace = this.extractTrace(optionalParams);
    super.error(messageStr, trace, context);
  }

  warn(message: any, ...optionalParams: any[]): void {
    const messageStr = this.stringifyMessage(message);
    const context = this.extractContext(optionalParams);
    super.warn(messageStr, context);
  }

  debug?(message: any, ...optionalParams: any[]): void {
    const messageStr = this.stringifyMessage(message);
    const context = this.extractContext(optionalParams);
    super.debug?.(messageStr, context);
  }

  verbose?(message: any, ...optionalParams: any[]): void {
    const messageStr = this.stringifyMessage(message);
    const context = this.extractContext(optionalParams);
    super.verbose?.(messageStr, context);
  }

  private stringifyMessage(message: any): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) return message.message;
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private extractContext(optionalParams: any[]): string | undefined {
    // NestJS passes context as the first optional param if it's a string
    if (optionalParams.length > 0 && typeof optionalParams[0] === 'string') {
      return optionalParams[0];
    }
    return undefined;
  }

  private extractTrace(optionalParams: any[]): string | undefined {
    // NestJS passes trace as the second optional param in error()
    if (optionalParams.length > 1 && typeof optionalParams[1] === 'string') {
      return optionalParams[1];
    }
    return undefined;
  }
}