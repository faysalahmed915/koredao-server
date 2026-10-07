import { z } from 'zod';

const originListSchema = z
  .string()
  .min(1, 'At least one origin must be configured')
  .refine(
    (value) => {
      const origins = value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

      if (origins.length === 0) {
        return false;
      }

      return origins.every((origin) => {
        if (origin === '*') {
          return false;
        }

        try {
          const url = new URL(origin);

          // Only HTTP(S) browser origins are allowed.
          if (!['http:', 'https:'].includes(url.protocol)) {
            return false;
          }

          // Wildcard hosts are not allowed.
          if (url.hostname.includes('*')) {
            return false;
          }

          // An origin must not contain a path.
          if (url.pathname !== '/' && url.pathname !== '') {
            return false;
          }

          // Credentials inside an origin are never valid for CORS.
          if (url.username || url.password) {
            return false;
          }

          return true;
        } catch {
          return false;
        }
      });
    },
    {
      message:
        'Must be a comma-separated list of valid HTTP(S) origins without wildcard (*) hosts or paths',
    },
  );

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .default(3000),

    APP_NAME: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .default('nestjs-enterprise-starter'),

    API_PREFIX: z
      .string()
      .regex(
        /^api\/v\d+$/,
        'API_PREFIX must use the format api/v1, api/v2, etc.',
      )
      .default('api/v1'),

    // -----------------------------------------------------------------------
    // Database
    // -----------------------------------------------------------------------

    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine(
        (value) =>
          value.startsWith('postgresql://') ||
          value.startsWith('postgres://'),
        'DATABASE_URL must be a PostgreSQL connection URL',
      ),

    // -----------------------------------------------------------------------
    // CORS / Rate limiting
    // -----------------------------------------------------------------------

    CORS_ORIGIN: originListSchema,

    THROTTLE_TTL: z.coerce
      .number()
      .int()
      .positive()
      .max(86_400_000)
      .default(60_000),

    THROTTLE_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .max(10_000)
      .default(100),

    // -----------------------------------------------------------------------
    // Better Auth
    // -----------------------------------------------------------------------

    BETTER_AUTH_SECRET: z
      .string()
      .min(
        32,
        'BETTER_AUTH_SECRET must be at least 32 characters long',
      ),

    BETTER_AUTH_URL: z
      .string()
      .url('BETTER_AUTH_URL must be a valid URL'),

    AUTH_BASE_PATH: z
      .string()
      .regex(
        /^\/[a-zA-Z0-9/_-]*$/,
        'AUTH_BASE_PATH must be an absolute URL path such as /api/auth',
      )
      .default('/api/auth'),

    BETTER_AUTH_TRUSTED_ORIGINS: originListSchema,

    // Google / Gmail OAuth
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // -----------------------------------------------------------------------
    // Payment Gateways (Aamarpay & PipraPay)
    // -----------------------------------------------------------------------
    AAMARPAY_STORE_ID: z.string().optional().default('aamarpaytest'),
    AAMARPAY_SIGNATURE_KEY: z.string().optional().default('dbb74894e82415a2f7ff0ec3a97e4183'),
    AAMARPAY_IS_SANDBOX: z.coerce.boolean().optional().default(true),

    PIPRAPAY_API_KEY: z.string().optional().default('demo_piprapay_key'),
    PIPRAPAY_MERCHANT_ID: z.string().optional().default('demo_piprapay_merchant'),
    PIPRAPAY_IS_SANDBOX: z.coerce.boolean().optional().default(true),

    PAYMENT_RETURN_URL: z.string().optional().default('http://localhost:3001/orders'),
    PAYMENT_CANCEL_URL: z.string().optional().default('http://localhost:3001/orders'),
  })
  .superRefine((config, ctx) => {
    if (config.NODE_ENV === 'production') {
      // Better Auth must use HTTPS in production.
      if (!config.BETTER_AUTH_URL.startsWith('https://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BETTER_AUTH_URL'],
          message: 'BETTER_AUTH_URL must use HTTPS in production',
        });
      }

      // Production browser origins should also use HTTPS.
      for (const field of [
        'CORS_ORIGIN',
        'BETTER_AUTH_TRUSTED_ORIGINS',
      ] as const) {
        const origins = config[field]
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

        const hasInsecureOrigin = origins.some(
          (origin) =>
            !origin.startsWith('https://') &&
            !origin.startsWith('http://localhost:') &&
            !origin.startsWith('http://127.0.0.1:'),
        );

        if (hasInsecureOrigin) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} must contain only HTTPS origins in production`,
          });
        }
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(
  config: Record<string, unknown>,
): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formattedErrors = result.error.issues
      .map(
        (err) =>
          `  - ${err.path.join('.') || 'root'}: ${err.message}`,
      )
      .join('\n');

    throw new Error(
      `\n❌ Invalid environment variable configuration:\n${formattedErrors}\n`,
    );
  }

  return result.data;
}