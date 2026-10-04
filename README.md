# Enterprise NestJS Starter

> Production-grade, large-scale NestJS starter architected with **defense-in-depth security as the highest priority**, clean modular domain boundaries, strict environment validation, and built-in readiness for **Better-Auth**, **Prisma ORM**, and **PostgreSQL**.

---

## Key Highlights

- 🛡️ **Security as Top Priority**: Pre-configured with **Helmet** (CSP, HSTS, noSniff, frameguard DENY), strict **CORS** origin matching, **Rate Limiting** via `@nestjs/throttler`, global mass-assignment protection with strict `AppValidationPipe`, and sanitized error outputs that suppress stack traces and database internal details in production.
- ⚡ **Better-Auth, Prisma & PostgreSQL Ready**: Complete PostgreSQL schema (`prisma/schema.prisma`) pre-configured with Better-Auth standard tables (`User`, `Session`, `Account`, `Verification`), along with a dedicated `AuthModule`, `AuthGuard`, and `@CurrentUser()` decorator.
- 🐳 **Local Infrastructure**: Instant local PostgreSQL database via `docker-compose.yml` with health checks and persistent volume persistence.
- 📐 **Clean Architecture & Smartly Foldered**: Modular monolith structure separating cross-cutting concerns (`src/common`), infrastructure singletons (`src/core`), type-safe config (`src/config`), and domain modules (`src/modules`).
- 🔍 **Distributed Tracing & Auditability**: Unique `x-correlation-id` injected across all requests, response headers, and structured logs with automatic PII and credential redaction.
- 📖 **Comprehensive Developer & AI Agent Guides**: Complete documentation suite for rapid onboarding of human developers and autonomous AI coding agents.
- 🚀 **Modern Tooling**: Powered by NestJS 12, TypeScript 5 (strict `nodenext`), Vitest, and Oxlint for ultra-fast builds and tests.

---

## Documentation Hub

| Document | Purpose |
|---|---|
| 📐 [ARCHITECTURE.md](docs/ARCHITECTURE.md) | High-level system architecture, folder topology, request lifecycle flowchart, and envelope specs |
| 🤖 [AGENT_GUIDE.md](docs/AGENT_GUIDE.md) | Strict coding standards, conventions, module creation recipe, and verification protocol for AI agents |
| 🛡️ [SECURITY.md](docs/SECURITY.md) | In-depth security manual, defensive controls matrix, OWASP Top 10 mitigation mapping, and key hygiene |
| 🐘 [DATABASE_PRISMA.md](docs/DATABASE_PRISMA.md) | PostgreSQL Docker setup, Prisma schema details, migrations, studio, and transaction management |
| 🔑 [BETTER_AUTH_GUIDE.md](docs/BETTER_AUTH_GUIDE.md) | Complete step-by-step blueprint for activating Better-Auth with Prisma and NestJS |
| ⚙️ [.agent/context.json](.agent/context.json) | Machine-readable project metadata and rules for AI agent tooling |

---

## Directory Topology

```
nestjs/
├── .agent/
│   └── context.json                   # Machine-readable metadata for AI agent tooling
├── docs/                              # Project architecture & workflow documentation
│   ├── ARCHITECTURE.md                # System topology, layers, request lifecycle
│   ├── AGENT_GUIDE.md                 # Explicit instructions & constraints for AI agents
│   ├── SECURITY.md                    # Security threat model & defense-in-depth design
│   ├── DATABASE_PRISMA.md             # Prisma & PostgreSQL setup, migrations, patterns
│   └── BETTER_AUTH_GUIDE.md           # Blueprint for Better-Auth integration
├── prisma/
│   └── schema.prisma                  # PostgreSQL schema with Better-Auth models
├── src/
│   ├── common/                        # Cross-cutting concerns & shared utilities
│   │   ├── constants/                 # Security constants & header tokens
│   │   ├── decorators/                # @Public(), @CurrentUser(), @CorrelationId()
│   │   ├── filters/                   # Global HttpExceptionFilter (sanitizes error leaks)
│   │   ├── interceptors/              # Logging (PII masked), Timeout, Transform envelope
│   │   ├── middleware/                # CorrelationIdMiddleware
│   │   └── pipes/                     # Strict AppValidationPipe (whitelist, reject unknown)
│   ├── config/                        # Strict type-safe environment configuration (Zod)
│   │   ├── app.config.ts              # Port, host, environment, API prefix
│   │   ├── auth.config.ts             # Auth secret, URLs, session settings
│   │   ├── database.config.ts         # PostgreSQL connection settings
│   │   ├── security.config.ts         # Throttling, CORS origins
│   │   └── env.validation.ts          # Zod schema validation on startup (fail-fast)
│   ├── core/                          # Singleton infrastructure modules
│   │   ├── database/                  # PrismaService & PrismaModule
│   │   └── health/                    # Terminus health checks (/health/live, /health)
│   ├── modules/                       # Domain feature modules
│   │   ├── auth/                      # Better-Auth integration layer & auth guards
│   │   └── users/                     # Example domain (controller, service, DTOs)
│   ├── app.module.ts                  # Root application module wiring
│   └── main.ts                        # Application bootstrap (Helmet, CORS, Swagger)
├── test/                              # End-to-end integration test suite
├── docker-compose.yml                 # Local PostgreSQL 16 container
├── .env.example                       # Documented environment template (zero secrets)
└── tsconfig.json                      # Strict NodeNext TypeScript compiler options
```

---

## Quickstart

### 1. Prerequisites
- **Node.js**: v20+ or v24+
- **Docker & Docker Compose**: (optional, for local PostgreSQL)

### 2. Setup Environment
Clone the repository and copy the environment template:
```bash
cp .env.example .env
```

### 3. Start Local PostgreSQL Database
```bash
docker compose up -d
```

### 4. Install Dependencies & Generate Prisma Client
```bash
npm install
npm run prisma:generate
```

### 5. Run Database Migrations (once DB is running)
```bash
npm run prisma:migrate
```

### 6. Start the Development Server
```bash
npm run start:dev
```

The application will start on `http://localhost:3000/api/v1`.
- **Interactive Swagger Documentation**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)
- **Liveness Probe**: [http://localhost:3000/health/live](http://localhost:3000/health/live)

---

## NPM Scripts

| Command | Action |
|---|---|
| `npm run start:dev` | Start NestJS in watch mode |
| `npm run build` | Build TypeScript production bundle to `dist/` |
| `npm run start:prod` | Run production build |
| `npm run lint` | Run ultra-fast Oxlint check |
| `npm run format` | Format codebase with Prettier |
| `npm run test` | Run unit tests with Vitest |
| `npm run test:e2e` | Run end-to-end API tests |
| `npm run test:cov` | Generate test coverage report |
| `npm run prisma:generate` | Regenerate Prisma Client types |
| `npm run prisma:migrate` | Run Prisma migrations |
| `npm run prisma:studio` | Launch visual Prisma database GUI |

---

## Security Verification

This starter enforces strict security boundaries by default:

1. **Mass Assignment Prevention**: Any request payload containing unexpected attributes is immediately rejected:
   ```json
   {
     "statusCode": 400,
     "message": "Validation failed",
     "errors": [{ "property": "unknownField", "constraints": { "whitelistValidation": "property unknownField should not exist" } }]
   }
   ```
2. **Error Masking**: Database queries and unhandled exceptions are masked in production:
   ```json
   {
     "statusCode": 500,
     "correlationId": "4f9b...-...",
     "message": "An unexpected error occurred"
   }
   ```
3. **Brute Force Protection**: Sensitive endpoints like `/api/v1/auth/login` enforce strict throttling (e.g. max 5 requests per minute per IP).

---

## License
MIT
