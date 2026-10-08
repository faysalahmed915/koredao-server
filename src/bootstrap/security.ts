import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

/**
 * Configures HTTP security headers (Helmet) and Cross-Origin Resource Sharing (CORS).
 */
export function setupSecurity(app: INestApplication): void {
  const logger = new Logger('BootstrapSecurity');
  const configService = app.get(ConfigService);

  const isProduction = configService.get<boolean>('app.isProduction', false);

  const configuredOrigins =
    configService.get<string[]>('security.corsOrigins') ??
    (configService.get<string>('CORS_ORIGIN') || configService.get<string>('CORS_ORIGINS'))
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  const defaultLocalOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'https://koredao-server.onrender.com',
  ];

  const corsOrigins = Array.from(new Set([...configuredOrigins, ...defaultLocalOrigins]));

  const httpAdapter = app.getHttpAdapter();
  const expressApp = httpAdapter.getInstance();

  // ============================================================
  // 1. HTTP SECURITY HEADERS (Helmet)
  // ============================================================
  const helmetFn: any = typeof helmet === 'function' ? helmet : (helmet as any)?.default;
  expressApp.use(
    helmetFn({
      contentSecurityPolicy: isProduction
        ? {
          directives: {
            defaultSrc: ["'self'"],
            // NOTE: unsafe-inline is commonly required by Swagger UI.
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", 'https:'],
          },
        }
        : false,

      crossOriginEmbedderPolicy: isProduction,

      crossOriginResourcePolicy: {
        policy: 'cross-origin',
      },

      // HSTS should only be used with an HTTPS-ready production deployment.
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },

      frameguard: {
        action: 'deny',
      },

      noSniff: true,

      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
    }),
  );

  // ============================================================
  // 2. CORS
  // ============================================================
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Requests without an Origin header (curl, Postman, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Explicit allowlist only or vercel subdomains. Do not allow '*' with credentials:true
      const isAllowed =
        corsOrigins.some(
          (allowed) =>
            allowed === origin || allowed === origin.replace(/\/$/, ''),
        ) ||
        (Boolean(origin) && origin.startsWith('https://') && origin.endsWith('.vercel.app'));

      if (isAllowed) {
        return callback(null, true);
      }

      logger.warn(`CORS policy blocked request from origin: ${origin}`);
      return callback(null, false);
    },

    credentials: true,

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-correlation-id',
      'x-request-id',
      'x-better-auth-version',
      'x-better-auth-agent',
    ],

    exposedHeaders: ['x-correlation-id', 'Set-Cookie', 'set-auth-token'],

    maxAge: 86400,
  });
}
