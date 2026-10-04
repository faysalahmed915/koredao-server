# PostgreSQL & Prisma ORM Guide

This guide details the database architecture, schema management, migration workflow, and connection lifecycle using **Prisma ORM** with **PostgreSQL 16**.

---

## 1. Local Database with Docker Compose

A pre-configured `docker-compose.yml` provides a localized PostgreSQL 16 Alpine instance with automated health checks and persistent volume storage.

### Starting PostgreSQL:
```bash
docker compose up -d
```

### Checking Database Health:
```bash
docker compose ps
```

### Stopping Database:
```bash
docker compose down
```

### Resetting Persistent Data (Fresh Start):
```bash
docker compose down -v
```

---

## 2. Environment Configuration

The PostgreSQL connection string is managed in `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres_secure_password@localhost:5432/starter_db?schema=public"
```

Connection parameters:
- **Host**: `localhost` (or `postgres` inside Docker networks)
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `postgres_secure_password`
- **Database**: `starter_db`

---

## 3. Prisma Schema Layout (`prisma/schema.prisma`)

The starter schema is pre-configured with PostgreSQL datasource and standard models for **Better-Auth** and application users:
- `User`: Core user identity, role, and timestamps
- `Session`: Active sessions with IP address, user agent, expiration date
- `Account`: OAuth providers and credential storage
- `Verification`: Token verification for email confirmation / password resets

---

## 4. Prisma Commands Cheat Sheet

| Task | Command | Description |
|---|---|---|
| **Generate Client** | `npm run prisma:generate` | Regenerates `@prisma/client` types after schema edits |
| **Apply Migration** | `npm run prisma:migrate` | Runs pending migrations and generates SQL migration files |
| **Open Prisma Studio** | `npm run prisma:studio` | Launches visual web interface for exploring database records |
| **Format Schema** | `npx prisma format` | Automatically formats `prisma/schema.prisma` |
| **Database Push** | `npx prisma db push` | Prototyping mode: pushes schema directly without creating migration files |
| **Validate Schema** | `npx prisma validate` | Checks schema syntax and relations |

---

## 5. NestJS Integration (`PrismaService`)

`src/core/database/prisma.service.ts` extends `PrismaClient` with lifecycle hooks:
- **`onModuleInit()`**: Connects to the database automatically. If the database is offline (e.g. during offline development or testing), it catches the exception and defers connection without crashing the process.
- **`onModuleDestroy()`**: Disconnects cleanly on application shutdown.
- **Query Logging**: Enabled automatically in `development` mode; disabled in `production` for security and performance.

### Usage in Services:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts() {
    return this.prisma.user.findMany();
  }
}
```

---

## 6. Transactions & Concurrency

Always use interactive transactions for operations that modify multiple records:
```typescript
await this.prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  await tx.account.create({ data: { ...accountData, userId: user.id } });
  return user;
});
```
