import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
} from '../constants/security.constants.js';

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawId =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined) ||
      (req.headers[REQUEST_ID_HEADER] as string | undefined);

    // Validate client-provided ID to prevent CRLF injection, log forgery, or buffer bloat
    const isValid = typeof rawId === 'string' && SAFE_ID_REGEX.test(rawId.trim());
    const correlationId = isValid ? rawId.trim() : uuidv4();

    // Attach to request object for use across interceptors/filters
    (req as Request & { correlationId: string }).correlationId = correlationId;

    // Propagate on response headers
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
