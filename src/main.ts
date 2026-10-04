import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module.js';
import {
  setupSecurity,
  setupAuth,
  setupHttp,
  setupValidation,
  setupSwagger,
} from './bootstrap/index.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Better Auth's Node handler must receive the raw request stream before
    // Express body parsers consume the body.
    bodyParser: false,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');

  // 1. Security Headers (Helmet) & CORS
  setupSecurity(app);

  // 2. Authentication (Better Auth mounted before body parsers)
  setupAuth(app);

  // 3. HTTP Configuration (Express body parsers, global prefix, shutdown hooks)
  setupHttp(app);

  // 4. Global Request Validation
  setupValidation(app);

  // 5. OpenAPI / Swagger Documentation
  setupSwagger(app);

  // 6. Start Application
  await app.listen(port);

  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  logger.log(
    `🔐 Better Auth endpoint configured for: http://localhost:${port}/api/auth`,
  );
}

bootstrap().catch((err) => {
  console.error('Fatal application bootstrap failure:', err);
  process.exit(1);
});
