import {
  ValidationPipe,
  ValidationError,
  BadRequestException,
} from '@nestjs/common';

export interface FormattedValidationError {
  property: string;
  constraints: Record<string, string>;
  children?: FormattedValidationError[];
}

function formatValidationErrors(
  errors: ValidationError[],
): FormattedValidationError[] {
  return errors.map((err) => ({
    property: err.property,
    constraints: err.constraints || {},
    ...(err.children && err.children.length > 0
      ? { children: formatValidationErrors(err.children) }
      : {}),
  }));
}

export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        const formatted = formatValidationErrors(errors);
        return new BadRequestException({
          message: 'Validation failed',
          errors: formatted,
        });
      },
    });
  }
}
