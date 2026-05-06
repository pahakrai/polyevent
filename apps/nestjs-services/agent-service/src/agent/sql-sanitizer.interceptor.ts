import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

const DANGEROUS_PATTERNS = [
  { regex: /\bDROP\s+/i, name: 'DROP' },
  { regex: /\bDELETE\s+FROM\b/i, name: 'DELETE FROM' },
  { regex: /\bTRUNCATE\s+/i, name: 'TRUNCATE' },
  { regex: /\bINSERT\s+INTO\b/i, name: 'INSERT INTO' },
  { regex: /\bUPDATE\s+\w+\s+SET\b/i, name: 'UPDATE ... SET' },
  { regex: /\bALTER\s+/i, name: 'ALTER' },
  { regex: /\bCREATE\s+/i, name: 'CREATE' },
  { regex: /\bGRANT\s+/i, name: 'GRANT' },
  { regex: /\bREVOKE\s+/i, name: 'REVOKE' },
  { regex: /\bEXEC\s*\(/i, name: 'EXEC(...)' },
  { regex: /;\s*\w+\s/, name: 'stacked queries (; ...)' },
  { regex: /\bUNION\s+SELECT\b/i, name: 'UNION SELECT injection' },
  { regex: /--\s*\w/, name: 'SQL comment injection (--)' },
  { regex: /\/\*[\s\S]*?\*\//, name: 'SQL block comment (/* */)' },
];

function scanForSql(obj: unknown, path: string): string | null {
  if (typeof obj === 'string') {
    for (const { regex, name } of DANGEROUS_PATTERNS) {
      if (regex.test(obj)) {
        return `Blocked "${name}" pattern at ${path}`;
      }
    }
    return null;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = scanForSql(obj[i], `${path}[${i}]`);
      if (result) return result;
    }
  }

  if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const result = scanForSql(value, `${path}.${key}`);
      if (result) return result;
    }
  }

  return null;
}

@Injectable()
export class SqlSanitizerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SqlSanitizerInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    if (!request.body) return next.handle();

    const blockReason = scanForSql(request.body, 'body');
    if (blockReason) {
      this.logger.warn(`SQL sanitizer blocked request: ${blockReason}`);
      throw new HttpException(
        { message: 'Request blocked by SQL sanitizer', reason: blockReason },
        HttpStatus.BAD_REQUEST,
      );
    }

    return next.handle();
  }
}
