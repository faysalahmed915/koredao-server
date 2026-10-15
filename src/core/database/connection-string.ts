/**
 * PostgreSQL connection-string hardening.
 *
 * `pg-connection-string` v2.14 (shipped with `pg` 8.23) emits a security warning
 * for the SSL modes `prefer`, `require` and `verify-ca`, because it currently
 * treats all three as aliases for `verify-full`, while `pg` v9 will switch them
 * to the weaker libpq semantics:
 *
 *   "SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are
 *    treated as aliases for 'verify-full'. In the next major version these modes
 *    will adopt standard libpq semantics, which have weaker security guarantees."
 *
 * Managed providers (Neon, Render, Supabase, Heroku) hand out `?sslmode=require`
 * by default, so this warning is on every startup and every script run.
 *
 * Rather than suppress it, this makes the intended behaviour explicit: an
 * aliased mode is rewritten to `verify-full`. That is byte-for-byte the
 * verification `pg` performs today, so nothing changes now — and when `pg` v9
 * arrives the connection can never silently downgrade to an unverified one.
 *
 * `sslmode=verify-full`, `disable` and the explicit opt-out `no-verify` are left
 * untouched, so an operator who genuinely needs to skip verification can still
 * say so.
 */

const ALIASED_SSL_MODES = new Set(['prefer', 'require', 'verify-ca']);

export interface SslNormalizationResult {
  connectionString: string;
  /** Set when a rewrite happened, so the caller can log it once. */
  upgradedFrom: string | null;
}

/**
 * Rewrites an aliased `sslmode` to `verify-full`.
 *
 * Deliberately a surgical string replacement instead of `new URL()` round-trip,
 * so credentials containing reserved characters are never re-encoded.
 */
export function normalizePostgresSslMode(
  connectionString: string | undefined,
): SslNormalizationResult {
  if (!connectionString) {
    return { connectionString: connectionString ?? '', upgradedFrom: null };
  }

  let upgradedFrom: string | null = null;

  const normalized = connectionString.replace(
    /([?&])sslmode=([^&#]*)/i,
    (match, prefix: string, rawValue: string) => {
      let decoded: string;
      try {
        decoded = decodeURIComponent(rawValue).trim().toLowerCase();
      } catch {
        decoded = rawValue.trim().toLowerCase();
      }

      if (!ALIASED_SSL_MODES.has(decoded)) return match;

      upgradedFrom = decoded;
      return `${prefix}sslmode=verify-full`;
    },
  );

  return { connectionString: normalized, upgradedFrom };
}
