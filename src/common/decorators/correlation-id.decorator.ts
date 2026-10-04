import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CORRELATION_ID_HEADER } from '../constants/security.constants.js';

/**
 * Parameter decorator to extract the correlation ID from the request headers
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return (
      (request.headers[CORRELATION_ID_HEADER] as string) ||
      (request.correlationId as string) ||
      'unknown-correlation-id'
    );
  },
);
