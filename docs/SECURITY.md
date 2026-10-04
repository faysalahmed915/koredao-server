# Security Architecture & Defense-in-Depth Specification

Security is the **highest priority** in this application. This document outlines the defensive layers, controls, threat mitigations, and operational standards implemented across the stack.

---

## 1. Defensive Controls Matrix

| Defensive Layer | Implementation | Threat Mitigated |
|---|---|---|
| **HTTP Security Headers** | `helmet` (CSP, HSTS, noSniff, frameguard DENY, referrerPolicy) | Clickjacking, MIME-sniffing, Protocol downgrade, XSS |
| **CORS Policy** | Strict origin matching via `CORS_ORIGIN` env | Cross-Origin Data Leakage, unauthorized browser queries |
| **Rate Limiting (DoS)** | `@nestjs/throttler` (Global + Tiered Auth limits) | Brute-force attacks, Credential stuffing, DoS/DDoS |
| **Request Timeout** | `TimeoutInterceptor` (15s default) | Slowloris attacks, hung thread pools |
| **Payload Limiting** | Express JSON & URL-encoded `limit: '10mb'` | Memory exhaustion attacks via massive payloads |
| **Strict Input Validation** | `AppValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) | Mass assignment, SQL/NoSQL parameter injection |
| **Information Concealment** | `HttpExceptionFilter` (strips stack traces and DB internals in prod) | System fingerprinting, database topology disclosure |
| **Audit & PII Redaction** | `LoggingInterceptor` with recursive field masking | Credential leaks into central log aggregators |
| **End-to-End Tracing** | `CorrelationIdMiddleware` (`x-correlation-id`) | Non-repudiation, incident forensic audit trails |
| **Fail-Fast Configuration** | `validateEnv` via Zod schema | Misconfiguration, weak or missing cryptographic keys |

---

## 2. OWASP Top 10 (2021) Mitigation Mapping

### A01: Broken Access Control
- Default-deny architecture: All endpoints are protected by `AuthGuard` unless explicitly decorated with `@Public()`.
- Scope/Role validation hooks prepared for RBAC (Role-Based Access Control).

### A02: Cryptographic Failures
- `BETTER_AUTH_SECRET` is validated on startup to enforce a minimum entropy length (16+ chars).
- HSTS enabled (`maxAge: 31536000`, `includeSubDomains: true`, `preload: true`) enforcing HTTPS only.

### A03: Injection
- Prisma ORM uses parameterized queries exclusively, eliminating SQL injection.
- Strict DTO schema validation strips unknown attributes and rejects non-whitelisted fields.

### A04: Insecure Design
- Multi-tier rate limiting protects sensitive endpoints (e.g. `/api/v1/auth/login` is limited to 5 attempts per minute).
- Clear separation between domain services and database access.

### A05: Security Misconfiguration
- Startup validation verifies all critical environment variables with Zod before accepting connections.
- Helmet removes `X-Powered-By: Express` header to conceal framework identity.

### A06: Vulnerable and Outdated Components
- Clean dependencies with zero legacy packages.
- Regular audits with `npm audit` and lockfile integrity.

### A07: Identification and Authentication Failures
- Architectural readiness for **Better-Auth** with modern session tokens, secure cookie flags (`HttpOnly`, `SameSite=Lax`, `Secure`), and brute-force throttling.

### A08: Software and Data Integrity Failures
- Package versions locked in `package-lock.json`.
- Strict typing with TypeScript 5+ and `nodenext` module resolution.

### A09: Security Logging and Monitoring Failures
- Every request carries an `x-correlation-id`.
- Request duration and status codes logged in real time.
- Passwords, bearer tokens, and secrets automatically redacted before outputting to stdout or log aggregators.

### A10: Server-Side Request Forgery (SSRF)
- No user-supplied URLs are fetched directly by the backend without strict domain allowlists.

---

## 3. Secret Management & Key Hygiene

- **Never commit `.env` files**: Only `.env.example` with harmless placeholder values is committed to version control.
- In production, inject secrets via secure secret stores (AWS Secrets Manager, HashiCorp Vault, Kubernetes Secrets).
- Cryptographic keys (`BETTER_AUTH_SECRET`) should be generated using cryptographically strong pseudo-random generators:
  ```bash
  openssl rand -base64 32
  ```

---

## 4. Vulnerability Disclosure & Incident Response

If you discover a security vulnerability, please do NOT create a public issue. Send details to security maintainers directly.
