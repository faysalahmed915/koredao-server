import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  // SECURITY:
  // No fallback secret.
  // env.validation.ts is responsible for ensuring this exists.
  secret: process.env.BETTER_AUTH_SECRET,

  // Better Auth's canonical application URL.
  url: process.env.BETTER_AUTH_URL,

  // SINGLE SOURCE OF TRUTH:
  // Used by Better Auth and the Express route mounting.
  basePath: process.env.AUTH_BASE_PATH || '/api/auth',

  // Explicit browser origins trusted by Better Auth.
  trustedOrigins: Array.from(
    new Set([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      ...(process.env.CORS_ORIGIN || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ]),
  ),

  // Google / Gmail OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
}));