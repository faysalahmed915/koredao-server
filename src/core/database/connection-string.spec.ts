import { describe, it, expect } from 'vitest';

import { normalizePostgresSslMode } from './connection-string.js';

describe('normalizePostgresSslMode', () => {
  it('upgrades the modes pg currently aliases to verify-full', () => {
    for (const mode of ['require', 'prefer', 'verify-ca', 'REQUIRE', 'Verify-Ca']) {
      const { connectionString, upgradedFrom } = normalizePostgresSslMode(
        `postgresql://user:pw@host/db?sslmode=${mode}`,
      );
      expect(connectionString).toContain('sslmode=verify-full');
      expect(upgradedFrom).toBe(mode.toLowerCase());
    }
  });

  it('leaves an already-explicit verify-full untouched', () => {
    const url = 'postgresql://user:pw@host/db?sslmode=verify-full';
    const { connectionString, upgradedFrom } = normalizePostgresSslMode(url);
    expect(connectionString).toBe(url);
    expect(upgradedFrom).toBeNull();
  });

  it('respects an explicit opt-out and disabled TLS', () => {
    for (const mode of ['no-verify', 'disable']) {
      const url = `postgresql://user:pw@host/db?sslmode=${mode}`;
      const { connectionString, upgradedFrom } = normalizePostgresSslMode(url);
      expect(connectionString).toBe(url);
      expect(upgradedFrom).toBeNull();
    }
  });

  it('preserves the other query parameters and their order', () => {
    const { connectionString } = normalizePostgresSslMode(
      'postgresql://user:pw@host/db?schema=public&sslmode=require&connect_timeout=15',
    );
    expect(connectionString).toBe(
      'postgresql://user:pw@host/db?schema=public&sslmode=verify-full&connect_timeout=15',
    );
  });

  it('handles sslmode in a non-leading position', () => {
    const { connectionString } = normalizePostgresSslMode(
      'postgresql://user:pw@host/db?sslmode=require&schema=public',
    );
    expect(connectionString).toBe(
      'postgresql://user:pw@host/db?sslmode=verify-full&schema=public',
    );
  });

  it('never re-encodes credentials', () => {
    // A surgical string replacement avoids the URL round-trip that could
    // re-encode reserved characters in a password.
    const url =
      'postgresql://user:p%40ss%2Fword@host/db?sslmode=require';
    const { connectionString } = normalizePostgresSslMode(url);
    expect(connectionString).toBe(
      'postgresql://user:p%40ss%2Fword@host/db?sslmode=verify-full',
    );
  });

  it('is a no-op when sslmode is absent or the URL is empty', () => {
    const noSsl = 'postgresql://user:pw@host/db';
    expect(normalizePostgresSslMode(noSsl)).toEqual({
      connectionString: noSsl,
      upgradedFrom: null,
    });
    expect(normalizePostgresSslMode('')).toEqual({
      connectionString: '',
      upgradedFrom: null,
    });
    expect(normalizePostgresSslMode(undefined)).toEqual({
      connectionString: '',
      upgradedFrom: null,
    });
  });

  it('does not touch a hostname that merely contains "sslmode"', () => {
    const url = 'postgresql://user:pw@sslmode.example.com/db?schema=public';
    const { connectionString, upgradedFrom } = normalizePostgresSslMode(url);
    expect(connectionString).toBe(url);
    expect(upgradedFrom).toBeNull();
  });
});
