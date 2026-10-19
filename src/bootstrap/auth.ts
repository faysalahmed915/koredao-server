import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toNodeHandler } from 'better-auth/node';

import { BETTER_AUTH } from '../modules/auth/auth.constants.js';

/**
 * Mounts Better Auth routes directly on the underlying Express application.
 *
 * CRITICAL ARCHITECTURE RULE:
 * Better Auth's Node handler MUST receive the request before Express body parsers
 * consume the incoming request body stream. Therefore, setupAuth() must be called
 * before setupHttp() registers express.json() and express.urlencoded().
 */
export function setupAuth(app: INestApplication, authInstance?: any): void {
  const logger = new Logger('BootstrapAuth');
  const configService = app.get(ConfigService);
  const authBasePath = configService.get<string>('auth.basePath', '/api/auth');

  const httpAdapter = app.getHttpAdapter();
  const expressApp = httpAdapter.getInstance();

  const auth = authInstance ?? app.get(BETTER_AUTH, { strict: false });

  if (!auth) {
    throw new Error(
      `[BootstrapAuth] Could not resolve BETTER_AUTH provider. Ensure AuthModule is imported in AppModule.`,
    );
  }

  // Mount handler on the base path and all nested routes.
  // Express 5 (path-to-regexp v8) uses `{*name}` for wildcards — the old
  // Express 4 `*` forms no longer match and silently 404 every handler route
  // (this broke /api/auth/session, sign-in, register, ...). The array covers
  // both the bare base path and every nested Better Auth sub-route.
  const normalizedBasePath = authBasePath.replace(/\/+$/, '');
  expressApp.all(
    [normalizedBasePath, `${normalizedBasePath}/{*splat}`],
    toNodeHandler(auth),
  );
  logger.log(`🔐 Better Auth mounted at: ${normalizedBasePath}`);
}