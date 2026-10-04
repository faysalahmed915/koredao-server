import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  SENSITIVE_FIELDS_REDACTION,
} from '../constants/security.constants.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  private sanitize(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (
        SENSITIVE_FIELDS_REDACTION.some((sensitiveKey) =>
          key.toLowerCase().includes(sensitiveKey.toLowerCase()),
        )
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { correlationId?: string }>();
    const response = ctx.getResponse<Response>();

    const { method, url } = request;
    const correlationId =
      (request.correlationId as string) ||
      (request.headers[CORRELATION_ID_HEADER] as string) ||
      'unknown-correlation-id';

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const delay = Date.now() - now;
          const { statusCode } = response;
          this.logger.log(
            `[${correlationId}] ${method} ${url} ${statusCode} - ${delay}ms`,
          );
        },
        error: (error: Error) => {
          const delay = Date.now() - now;
          this.logger.warn(
            `[${correlationId}] ${method} ${url} ERROR after ${delay}ms: ${error.message}`,
          );
        },
      }),
    );
  }
}
