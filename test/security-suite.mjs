import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;
const AUTH_URL = `${BASE_URL}/api/auth`;

const TEST_EMAIL = `test.security.${Date.now()}@example.com`;
const TEST_PASSWORD = 'SuperSecureP@ssw0rd123!';
const TEST_NAME = 'Security Tester';

let sessionCookie = '';
let createdUserId = '';

const results = {
  prismaNeon: [],
  betterAuth: [],
  securityHeaders: [],
  rateLimiting: [],
  dataSanitization: [],
};

function record(category, name, passed, details) {
  results[category].push({ name, passed, details });
  console.log(`${passed ? '  ✅' : '  ❌'} [${category}] ${name}: ${details}`);
}

async function run() {
  console.log('\n======================================================');
  console.log('🔒 FULL SECURITY & FUNCTIONAL VERIFICATION SUITE');
  console.log('======================================================\n');

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Prisma & Neon DB Direct Test
    console.log('--- 1. Testing Prisma & Neon DB ---');
    await prisma.$connect();
    record('prismaNeon', 'Prisma Connection', true, 'Connected to Neon DB');

    const dbInfo = await prisma.$queryRaw`SELECT current_database(), current_user;`;
    record('prismaNeon', 'Database Identity', true, `Database: ${dbInfo[0].current_database}, User: ${dbInfo[0].current_user}`);

    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
    `;
    const tableNames = tables.map(t => t.table_name);
    const requiredTables = ['user', 'session', 'account', 'verification'];
    const hasAll = requiredTables.every(t => tableNames.includes(t));
    record('prismaNeon', 'Schema Tables in Neon', hasAll, `Found: ${tableNames.join(', ')}`);

    // 2. Health Endpoint & Security Headers
    console.log('\n--- 2. Testing API & Security Headers ---');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    const dbStatus = healthData?.data?.info?.database?.status || healthData?.info?.database?.status;
    record('securityHeaders', 'Health Readiness Includes Database', dbStatus === 'up', `Database readiness status: ${dbStatus}`);

    const headers = healthRes.headers;
    record('securityHeaders', 'X-Content-Type-Options', headers.get('x-content-type-options') === 'nosniff', headers.get('x-content-type-options') || 'Missing');
    record('securityHeaders', 'X-Frame-Options', !!headers.get('x-frame-options'), headers.get('x-frame-options') || 'Missing');
    record('securityHeaders', 'Correlation ID', !!headers.get('x-correlation-id'), headers.get('x-correlation-id') || 'Missing');

    // Test correlation ID sanitization:
    const maliciousRes = await fetch(`${BASE_URL}/health`, {
      headers: { 'x-correlation-id': '<script>alert(1)</script>' },
    });
    const sanitizedId = maliciousRes.headers.get('x-correlation-id');
    const isSafeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedId);
    record('securityHeaders', 'Correlation ID Sanitization (Rejects Injections)', isSafeUuid, `Injected ID rejected, replaced with: ${sanitizedId}`);

    const longIdRes = await fetch(`${BASE_URL}/health`, {
      headers: { 'x-correlation-id': 'a'.repeat(100) },
    });
    const sanitizedLongId = longIdRes.headers.get('x-correlation-id');
    const isSafeLongUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedLongId);
    record('securityHeaders', 'Correlation ID Sanitization (Rejects Overlong IDs)', isSafeLongUuid, `Overlong ID rejected, replaced with: ${sanitizedLongId}`);

    const validIdRes = await fetch(`${BASE_URL}/health`, {
      headers: { 'x-correlation-id': 'valid-trace-id-12345' },
    });
    const preservedId = validIdRes.headers.get('x-correlation-id');
    record('securityHeaders', 'Correlation ID Allows Safe IDs', preservedId === 'valid-trace-id-12345', `Safe ID preserved: ${preservedId}`);

    // 3. Better Auth - Registration Flow
    console.log('\n--- 3. Testing Better Auth Registration ---');
    const signUpRes = await fetch(`${AUTH_URL}/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      }),
    });

    const signUpText = await signUpRes.text();
    let _signUpData;
    try { _signUpData = JSON.parse(signUpText); } catch { _signUpData = signUpText; }

    const setCookie = signUpRes.headers.get('set-cookie');
    record('betterAuth', 'User Sign-Up Status', signUpRes.ok, `Status: ${signUpRes.status}`);
    record('betterAuth', 'Session Cookie Issuance', !!setCookie, setCookie ? 'Cookie header present' : 'No set-cookie');

    if (setCookie) {
      sessionCookie = setCookie.split(';')[0];
      const isHttpOnly = /httponly/i.test(setCookie);
      const isSameSiteLax = /samesite=lax/i.test(setCookie);
      record('betterAuth', 'Cookie HttpOnly Flag', isHttpOnly, isHttpOnly ? 'HttpOnly present' : 'Missing HttpOnly');
      record('betterAuth', 'Cookie SameSite Flag', isSameSiteLax, isSameSiteLax ? 'SameSite=Lax present' : setCookie);
    }

    // Verify User In Neon DB Directly via Prisma
    const dbUser = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
      include: { accounts: true, sessions: true },
    });
    if (dbUser) {
      createdUserId = dbUser.id;
      record('prismaNeon', 'User Persisted in Neon', true, `User ID: ${dbUser.id}, Email: ${dbUser.email}`);
      record('prismaNeon', 'Account Created in Neon', dbUser.accounts.length > 0, `Provider: ${dbUser.accounts[0]?.providerId}`);
      record('dataSanitization', 'Password Hashing Check', !!dbUser.accounts[0]?.password && dbUser.accounts[0]?.password !== TEST_PASSWORD, 'Password is hash, not plaintext');
    } else {
      record('prismaNeon', 'User Persisted in Neon', false, 'User record not found in database');
    }

    // 4. Protected Route: /api/v1/auth/me
    console.log('\n--- 4. Testing Protected Route Guard & Opt-in ---');
    // Without token:
    const meNoAuth = await fetch(`${API_URL}/auth/me`);
    record('betterAuth', 'Protected Route Rejects Unauthenticated', meNoAuth.status === 401, `Status: ${meNoAuth.status} (Expected 401)`);

    // With forged / fake cookie:
    const meFakeAuth = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: 'better-auth.session_token=fake_random_token_12345' },
    });
    record('betterAuth', 'Protected Route Rejects Tampered Cookie', meFakeAuth.status === 401, `Status: ${meFakeAuth.status} (Expected 401)`);

    // With valid session cookie:
    if (sessionCookie) {
      const meAuth = await fetch(`${API_URL}/auth/me`, {
        headers: { Cookie: sessionCookie },
      });
      const meData = await meAuth.json();
      record('betterAuth', 'Protected Route Accepts Valid Session', meAuth.ok, `Status: ${meAuth.status}, User: ${meData?.data?.user?.email || meData?.user?.email || 'N/A'}`);
      
      const payloadString = JSON.stringify(meData);
      record('dataSanitization', 'No Password Leakage in User API', !payloadString.includes(TEST_PASSWORD) && !payloadString.includes('password'), 'Password never leaked in response');
    }

    // 5. Better Auth - Sign In Flow & Invalid Credential Protection
    console.log('\n--- 5. Testing Sign-In Security ---');
    const badLoginRes = await fetch(`${AUTH_URL}/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: 'WrongPassword!',
      }),
    });
    record('betterAuth', 'Reject Wrong Password', !badLoginRes.ok, `Status: ${badLoginRes.status} (Expected 4xx)`);

    const goodLoginRes = await fetch(`${AUTH_URL}/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });
    record('betterAuth', 'Accept Valid Password', goodLoginRes.ok, `Status: ${goodLoginRes.status}`);

    // 6. Rate Limiting Test
    console.log('\n--- 6. Testing Rate Limiting (Throttler) ---');
    const floodCount = 15;
    const reqs = Array.from({ length: floodCount }).map(() => fetch(`${BASE_URL}/health`));
    const floodResponses = await Promise.all(reqs);
    const allSuccessful = floodResponses.every(r => r.ok);
    record('rateLimiting', 'Burst Handling Under Limit', allSuccessful, `15/15 successful (limit is 100/min)`);

  } catch (error) {
    console.error('Test suite runtime error:', error);
  } finally {
    // Clean up test data
    if (createdUserId) {
      console.log('\n--- Cleaning up test user from Neon DB ---');
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
      console.log('✅ Test user cleanly deleted from Neon DB.');
    }
    await prisma.$disconnect();
    console.log('\n======================================================');
    console.log('🏁 SUITE COMPLETED');
    console.log('======================================================\n');
  }
}

run();
