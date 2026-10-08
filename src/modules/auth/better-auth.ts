import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { bearer } from 'better-auth/plugins';

import type { ConfigType } from '@nestjs/config';

import type { PrismaService } from '../../core/database/prisma.service.js';
import { authConfig } from '../../config/auth.config.js';
import { UserRole } from '@prisma/client';

export const createBetterAuth = (
  prisma: PrismaService,
  config: ConfigType<typeof authConfig>,
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
      defaultCookieAttributes: {
        sameSite: isHttps ? 'none' : 'lax',
        secure: isHttps,
        partitioned: isHttps,
      },
    },
  });
};

export type Auth = ReturnType<typeof createBetterAuth>;