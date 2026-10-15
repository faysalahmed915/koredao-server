import { describe, it, expect } from 'vitest';

import {
  DEFAULT_IP_ADDRESS_HEADERS,
  DEFAULT_TRUSTED_PROXY_IPS,
  DEFAULT_TRUST_PROXY,
  parseCsv,
  parseTrustProxy,
} from './ip.config.js';

describe('parseTrustProxy', () => {
  it('defaults to trusting loopback and private ranges', () => {
    expect(parseTrustProxy(undefined)).toBe(DEFAULT_TRUST_PROXY);
    expect(parseTrustProxy('')).toBe(DEFAULT_TRUST_PROXY);
    expect(parseTrustProxy('   ')).toBe(DEFAULT_TRUST_PROXY);
  });

  it('disables trust proxy for explicit negative values', () => {
    for (const value of ['false', 'FALSE', 'off', 'none', 'no']) {
      expect(parseTrustProxy(value)).toBe(false);
    }
  });

  it('trusts everything only when explicitly asked', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('all')).toBe(true);
  });

  it('parses a hop count as a number, not a string', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('passes proxy-addr presets and CIDR lists through untouched', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
    expect(parseTrustProxy('uniquelocal')).toBe('uniquelocal');
  });
});

describe('parseCsv', () => {
  it('splits, trims and drops empty entries', () => {
    expect(parseCsv(' a , b ,, c ', ['fallback'])).toEqual(['a', 'b', 'c']);
  });

  it('falls back when the value is missing or empty', () => {
    expect(parseCsv(undefined, ['x'])).toEqual(['x']);
    expect(parseCsv('', ['x'])).toEqual(['x']);
    expect(parseCsv(' , , ', ['x'])).toEqual(['x']);
  });

  it('returns a copy of the fallback so callers cannot mutate the default', () => {
    const result = parseCsv(undefined, DEFAULT_IP_ADDRESS_HEADERS);
    result.push('mutated');
    expect(DEFAULT_IP_ADDRESS_HEADERS).not.toContain('mutated');
  });
});

describe('IP resolution defaults', () => {
  it('consults x-forwarded-for first (what Render and Next.js send)', () => {
    expect(DEFAULT_IP_ADDRESS_HEADERS[0]).toBe('x-forwarded-for');
  });

  it('treats loopback and private ranges as proxy hops', () => {
    // Better Auth rejects any entry that is not an IP or CIDR range, so these
    // must all be valid CIDR strings.
    for (const entry of DEFAULT_TRUSTED_PROXY_IPS) {
      expect(entry).toMatch(/^[0-9a-fA-F.:]+\/\d+$/);
    }
    expect(DEFAULT_TRUSTED_PROXY_IPS).toContain('10.0.0.0/8');
  });
});
