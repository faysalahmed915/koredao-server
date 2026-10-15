import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import express from 'express';

/**
 * Configures HTTP routing prefix, body parsers, and graceful shutdown hooks.
 *
 * NOTE:
 * Body parsers are registered here for standard NestJS routes.
 * If Better Auth is used, Better Auth's handler must be mounted BEFORE
 * this setup is executed because bodyParser: false is set at NestFactory.create.
 */
export function setupHttp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const trustProxy = configService.get<boolean | number | string>(
    'security.ip.trustProxy',
    'loopback, uniquelocal',
  );

  const httpAdapter = app.getHttpAdapter();
  const expressApp = httpAdapter.getInstance();

  // 1. Trust the fronting proxy so `req.ip` / `req.ips` carry the real client
  //    address. Without this, every request behind a platform proxy looks like
  //    it came from the proxy and the global throttler shares one bucket for all
  //    users. The default only trusts loopback and private ranges.
  expressApp.set('trust proxy', trustProxy);

  // 2. Express body size limits for NestJS routes
  expressApp.use(
    express.json({
      limit: '1mb',
    }),
  );

  expressApp.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
    }),
  );

  // 3. Global routing prefix
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['/', '', 'health', 'health/live'],
  });

  // 4. Graceful shutdown hooks
  app.enableShutdownHooks();
}
