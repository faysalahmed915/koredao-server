import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { bearer } from 'better-auth/plugins';

import type { ConfigType } from '@nestjs/config';

import type { PrismaService } from '../../core/database/prisma.service.js';
import { authConfig } from '../../config/auth.config.js';
import { UserRole } from '@prisma/client';

export interface AuthIpConfig {
  /** Headers to read the client address from, in priority order. */
  ipAddressHeaders: string[];
  /** Proxy hops to skip when walking a forwarded chain. */
  trustedProxies: string[];
}

export const createBetterAuth = (
  prisma: PrismaService,
  config: ConfigType<typeof authConfig>,
  ip: AuthIpConfig,
) => {
  const isHttps = config.url?.startsWith('https') || process.env.NODE_ENV === 'production';

  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),

    secret: config.secret,
    baseURL: config.url,
    basePath: config.basePath,
    trustedOrigins: config.trustedOrigins,

    plugins: [bearer()],

    emailAndPassword: {
      enabled: true,
    },

    socialProviders:
      config.google?.clientId && config.google?.clientSecret
        ? {
          google: {
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret,
          },
        }
        : {},

    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: UserRole.CUSTOMER,
          input: false,
        },
      },
    },

    advanced: {
      database: {
        joins: true,
      },
      /**
       * Client-IP resolution for the built-in rate limiter.
       *
       * Without this, Better Auth cannot identify the caller behind a proxy and
       * falls back to a single shared per-path bucket — one client can then
       * exhaust the limit for every user, and per-client limiting never really
       * happens. `trustedProxies` makes it pick the right-most *untrusted*
       * address from the forwarded chain rather than trusting a client-supplied
       * value outright.
       */
      ipAddress: {
        ipAddressHeaders: ip.ipAddressHeaders,
        trustedProxies: ip.trustedProxies,
      },
      defaultCookieAttributes: {
        sameSite: isHttps ? 'none' : 'lax',
        secure: isHttps,
        partitioned: isHttps,
      },
    },
  });
};

export type Auth = ReturnType<typeof createBetterAuth>;