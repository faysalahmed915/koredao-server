import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Sets up OpenAPI / Swagger documentation in non-production environments.
 */
export function setupSwagger(app: INestApplication): void {
  const logger = new Logger('BootstrapSwagger');
  const configService = app.get(ConfigService);

  const isProduction = configService.get<boolean>('app.isProduction', false);
  if (isProduction) {
    return;
  }

  const port = configService.get<number>('app.port', 3000);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Enterprise NestJS API')
    .setDescription(
      'Production-grade NestJS REST API with PostgreSQL, Prisma, Better Auth, and defense-in-depth security.',
    )
    .setVersion('1.0.0')
    // Better Auth uses session-based authentication via cookie
    .addCookieAuth('better-auth.session_token', {
      type: 'apiKey',
      in: 'cookie',
      description: 'Better Auth session cookie used for authenticated requests.',
    })
    .addTag('Health & Monitoring')
    .addTag('Authentication')
    .addTag('Users')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  logger.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}
