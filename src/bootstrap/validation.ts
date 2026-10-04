import type { INestApplication } from '@nestjs/common';
import { AppValidationPipe } from '../common/pipes/app-validation.pipe.js';

/**
 * Configures strict global validation pipes for NestJS controllers and DTOs.
 */
export function setupValidation(app: INestApplication): void {
  app.useGlobalPipes(new AppValidationPipe());
}
