# Agent & Developer Workflow Guide

This document contains strict conventions, rules, and workflows for **AI Coding Agents** (and human engineers) operating in this repository.

---

## 1. Core Directives for AI Agents

1. **Security Guardrails are Mandatory**:
   - Every new controller endpoint is protected by default by `AuthGuard`.
   - To make an endpoint publicly accessible, you **must** explicitly decorate it with `@Public()`.
   - Never disable or bypass `AppValidationPipe` or `HttpExceptionFilter`.
   - Never log passwords, tokens, API keys, or sensitive credentials.

2. **TypeScript & NodeNext Module Resolution**:
   - This project compiles under `"module": "nodenext"` and `"target": "ES2023"`.
   - All relative TypeScript imports **must** include the `.js` extension:
     ```typescript
     // Correct
     import { UsersService } from './users.service.js';
     // Incorrect
     import { UsersService } from './users.service';
     ```
   - When importing types in decorated files with `emitDecoratorMetadata`, use `import type { MyType } from ...`.

3. **Validation & DTOs**:
   - Every payload parameter (`@Body()`, `@Query()`, `@Param()`) must be strongly typed with a class annotated with `class-validator` and `class-transformer` decorators.
   - Any extra property not defined on the DTO will be rejected with HTTP 400 (`forbidNonWhitelisted: true`).

---

## 2. Recipe: Adding a New Domain Module

When creating a new domain feature (e.g., `products`, `orders`), follow this exact layout:

```
src/modules/products/
├── dto/
│   ├── create-product.dto.ts    # Creation input with class-validator decorators
│   ├── update-product.dto.ts    # Partial update input with @IsOptional()
│   └── query-products.dto.ts    # Pagination & filter parameters
├── products.controller.ts       # Swagger @ApiTags, route handlers, status codes
├── products.service.ts          # Business logic, Prisma queries, error mapping
├── products.module.ts           # Module declaration exporting service
└── products.controller.spec.ts  # Unit tests
```

### Checklist for New Endpoints:
- [ ] Add `@ApiTags('FeatureName')` to controller
- [ ] Add `@ApiOperation({ summary: '...' })` and `@ApiResponse()` for all return status codes
- [ ] Decorate with `@Public()` if unauthenticated access is explicitly intended
- [ ] Decorate with `@Throttle({ default: { limit: N, ttl: M } })` if it is a sensitive or costly operation
- [ ] Verify unit tests pass: `npm run test`
- [ ] Verify build passes: `npm run build`

---

## 3. Database Schema Changes (Prisma)

When updating the database models:
1. Edit `prisma/schema.prisma`.
2. Run `npm run prisma:generate` to refresh `@prisma/client` types.
3. If PostgreSQL is running: `npm run prisma:migrate -- --name <migration_name>`.
4. Never manually write SQL schema modifications unless dealing with advanced extensions.

---

## 4. Verification Protocol

Before declaring any coding task complete, run this verification sequence in terminal:

```bash
# 1. Check TypeScript compilation
npm run build

# 2. Run linter
npm run lint

# 3. Execute unit tests
npm run test

# 4. Execute end-to-end integration tests
npm run test:e2e
```
