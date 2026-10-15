/**
 * Client-IP resolution configuration.
 *
 * Better Auth rate-limits per client IP and NestJS's `ThrottlerGuard` keys its
 * buckets on `req.ip`. Both silently degrade to a **single shared bucket** when
 * the real client address cannot be resolved, which means one abusive client can
 * exhaust the limit for everybody — the exact warning Better Auth emits:
 *
 *   "Rate limiting could not determine a client IP and is falling back to a
 *    single shared per-path bucket."
 *
 * Two things are needed for a correct address:
 *   1. Express must trust the fronting proxy so `req.ip`/`req.ips` reflect the
 *      forwarded chain (`TRUST_PROXY`), and
 *   2. Better Auth must be told which headers carry the address and which hops
 *      are proxies, so it can pick the right-most *untrusted* entry instead of
 *      trusting a client-supplied value (`IP_ADDRESS_HEADERS`,
 *      `TRUSTED_PROXY_IPS`).
 *
 * SECURITY: `trust proxy` / `trustedProxies` must only be enabled when the app
 * really sits behind a trusted proxy. If the origin is directly reachable, a
 * client can forge these headers and rotate its own bucket. Set
 * `TRUST_PROXY=false` for a directly-exposed deployment.
 */

/** The value Express's `trust proxy` accepts. */
export type TrustProxySetting = boolean | number | string;

/**
 * Loopback plus the private ranges a platform proxy (Render, Fly, Railway, a
 * same-host nginx, Kubernetes ingress) typically connects from. Private
 * addresses are not routable from the internet, so treating them as proxy hops
 * cannot misclassify a real client.
 */
export const DEFAULT_TRUST_PROXY = 'loopback, uniquelocal';

/**
 * Default headers consulted by Better Auth, in priority order. `x-forwarded-for`
 * is what Render and Next.js set; the others cover nginx and Cloudflare fronts.
 */
export const DEFAULT_IP_ADDRESS_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
] as const;

/**
 * Default proxy hops for Better Auth's chain walk. Must be an IP or CIDR list
 * (Better Auth rejects anything else and warns).
 */
export const DEFAULT_TRUSTED_PROXY_IPS = [
  '127.0.0.0/8',
  '::1/128',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  'fc00::/7',
] as const;

/**
 * Parses `TRUST_PROXY` into the value Express expects.
 *
 * Accepts `false`/`off`/`none` (disabled), `true`/`all` (trust everything —
 * only safe when the app is never reachable directly), a hop count such as `1`,
 * or a `proxy-addr` preset/CIDR list such as `loopback, 10.0.0.0/8`.
 */
export function parseTrustProxy(raw: string | undefined): TrustProxySetting {
  const value = (raw ?? '').trim();
  if (value === '') return DEFAULT_TRUST_PROXY;

  const lower = value.toLowerCase();
  if (['false', 'off', 'none', 'no'].includes(lower)) return false;
  if (['true', 'all', 'yes'].includes(lower)) return true;
  if (/^\d+$/.test(value)) return Number(value);

  return value;
}

/** Splits a comma-separated env value, falling back when it is empty. */
export function parseCsv(raw: string | undefined, fallback: readonly string[]): string[] {
  const values = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return values.length > 0 ? values : [...fallback];
}
