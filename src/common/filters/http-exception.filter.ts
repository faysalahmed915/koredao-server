import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '../constants/security.constants.js';

interface ErrorResponseEnvelope {
  statusCode: number;
  timestamp: string;
  path: string;
  correlationId: string;
  message: string | object;
  errors?: unknown[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    if (response.headersSent) {
      return;
    }

    const correlationId =
      (request.correlationId as string) ||
      (request.headers[CORRELATION_ID_HEADER] as string) ||
      'unknown-correlation-id';

    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let errors: unknown[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string | object) || exception.message;
        if (Array.isArray(resObj.errors)) {
          errors = resObj.errors;
        } else if (Array.isArray(resObj.message)) {
          errors = resObj.message;
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof Error) {
      // Unhandled application or database error
      // In production, do NOT leak internal stack traces or database schema error messages
      message = isProduction ? 'An unexpected error occurred' : exception.message;

      this.logger.error(
        `[${correlationId}] Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `[${correlationId}] Non-error thrown: ${JSON.stringify(exception)}`,
      );
    }

    const errorResponse: ErrorResponseEnvelope = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
      message,
      ...(errors && { errors }),
    };

    // Log 4xx warnings and 5xx errors
    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} ${status} - Response: ${JSON.stringify(errorResponse)}`,
      );
    } else {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} ${status} - Warning: ${JSON.stringify(errorResponse)}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
