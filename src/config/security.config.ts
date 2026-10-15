import { registerAs } from '@nestjs/config';
import {
  DEFAULT_IP_ADDRESS_HEADERS,
  DEFAULT_TRUSTED_PROXY_IPS,
  DEFAULT_TRUST_PROXY,
  parseCsv,
  parseTrustProxy,
} from './ip.config.js';

export const securityConfig = registerAs('security', () => ({
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim()),
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
  /**
   * Client-IP resolution. Without this, both the NestJS throttler and Better
   * Auth's rate limiter degrade to one shared bucket for all clients.
   */
  ip: {
    /** Value for Express's `trust proxy` (hop count, preset or CIDR list). */
    trustProxy: parseTrustProxy(
      process.env.TRUST_PROXY || DEFAULT_TRUST_PROXY,
    ),
    /** Headers Better Auth may read the client address from, in priority order. */
    ipAddressHeaders: parseCsv(
      process.env.IP_ADDRESS_HEADERS,
      DEFAULT_IP_ADDRESS_HEADERS,
    ),
    /** Hops Better Auth should skip when walking a forwarded chain. */
    trustedProxies: parseCsv(
      process.env.TRUSTED_PROXY_IPS,
      DEFAULT_TRUSTED_PROXY_IPS,
    ),
  },
}));
