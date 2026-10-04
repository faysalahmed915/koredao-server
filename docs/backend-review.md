# NestJS Backend — Potential Problems Checklist

## 🔴 High Priority

### 1. CORS + Credentials

* Current: `credentials: true`
* Current code also allows `*` through `corsOrigins.includes('*')`.
* **Problem:** Credentialed CORS should use explicit trusted origins.
* **Later:** Remove/disable wildcard support when credentials are enabled.
* Also verify Better Auth cookie settings: `SameSite`, `Secure`, `Domain`, HTTPS/proxy configuration.

### 2. 10MB Request Body Limit

* Current:

  * JSON: `10mb`
  * URL-encoded: `10mb`
* **Problem:** Larger-than-needed request bodies can increase memory/DoS risk.
* **Later:** Use a smaller limit for normal API requests.
* If file uploads are needed, use dedicated upload handling/object storage instead of huge JSON bodies.

### 3. HSTS Preload

* Current:

  * `maxAge: 31536000`
  * `includeSubDomains: true`
  * `preload: true`
* **Problem:** This is a strong production HTTPS commitment.
* **Later:** Confirm the production domain **and all relevant subdomains** are permanently HTTPS-ready before enabling preload.

---

## 🟡 Medium Priority

### 4. CSP Needs Testing/Tightening

Current production CSP contains:

* `'unsafe-inline'` for styles
* `https:` for images
* `http:`, `https:`, `ws:`, `wss:` for connections

**Problem:** These are convenient but relatively broad.

**Later:** Check actual frontend/API requirements and make CSP as restrictive as practical.

---

### 5. `enableImplicitConversion: true`

In `AppValidationPipe`:

```ts
enableImplicitConversion: true
```

**Problem:** Automatically converts types and can sometimes hide invalid client input.

Example:

```text
?page=10
```

becomes:

```ts
page: 10
```

**Later:** Check DTOs carefully and use explicit validators such as:

```ts
@IsInt()
@Type(() => Number)
page: number;
```

---

### 6. Strict DTO Validation

Current:

```ts
whitelist: true
forbidNonWhitelisted: true
```

**Good security choice**, but:

* Every accepted DTO property should have proper validation decorators.
* Otherwise a property may unexpectedly be treated as non-whitelisted.
* Check actual DTOs later.

---

### 7. Class Validator vs Zod

Both are installed:

```text
class-validator
class-transformer
zod
```

**Problem:** Two validation systems can create inconsistent patterns.

**Later:** Decide where each one is actually needed.

Current `AppValidationPipe` clearly uses **class-validator**.

---

## 🟢 Things to Verify Later

### 8. Swagger Authentication

Swagger currently documents:

* Bearer/JWT authentication
* Better Auth session cookie

**Later:** Confirm these match the actual authentication implementation.

Also reconsider:

```ts
persistAuthorization: true
```

especially on shared computers.

---

### 9. Health Check Routes

Global prefix:

```text
/api/v1
```

but health routes are excluded.

**Later:** Confirm the actual health controller paths match:

```text
/
health
health/live
```

---

### 10. Request/Correlation IDs

CORS already allows:

```text
x-correlation-id
x-request-id
```

and exposes:

```text
x-correlation-id
```

**Later:** Check whether actual middleware/interceptors generate and propagate these IDs.

---

### 11. Production CSP Connections

Current CSP allows:

```text
http:
ws:
```

**Later:** If production only uses HTTPS/WSS, tighten this to avoid unnecessary insecure connection sources.

---

### 12. Authentication ≠ CORS

Allowing a request through CORS does **not** authenticate the user.

**Later:** Make sure authentication + authorization protect every sensitive endpoint.

---

# Quick Checklist

When reviewing the remaining files, check:

* [ ] CORS wildcard + credentials
* [ ] 10MB body limit
* [ ] HSTS preload
* [ ] CSP
* [ ] Implicit type conversion
* [ ] DTO decorators
* [ ] class-validator vs Zod
* [ ] Swagger auth
* [ ] Health routes
* [ ] Request/correlation IDs
* [ ] Better Auth cookie configuration
* [ ] Authentication/authorization
* [ ] Production HTTPS/WSS configuration

**Important:** Don't fix everything immediately. First review the related files. Some apparent problems may be intentionally handled somewhere else in the project.
