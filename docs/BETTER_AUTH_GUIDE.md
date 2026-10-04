# Better-Auth Integration Guide

This document provides a step-by-step blueprint for integrating **Better-Auth** into this NestJS starter project alongside **Prisma** and **PostgreSQL**.

---

## 1. Overview

[Better-Auth](https://better-auth.com) is a comprehensive, framework-agnostic TypeScript authentication framework supporting:
- Email and password with verification
- OAuth social logins (Google, GitHub, Discord, Apple, etc.)
- Session management & multi-session support
- Two-factor authentication (2FA / TOTP)
- Role-based access control (RBAC)
- Native Prisma adapter

The project's database schema (`prisma/schema.prisma`) and authentication layer (`src/modules/auth`) are already pre-configured to match Better-Auth's requirements.

---

## 2. Activation Steps

### Step 1: Install `better-auth`
When you are ready to activate Better-Auth:
```bash
npm install better-auth
```

### Step 2: Initialize Better-Auth Instance
Create `src/modules/auth/better-auth.instance.ts`:

```typescript
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // set true in production
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,             // 5 minutes
    },
  },
  // Add OAuth providers as needed:
  // socialProviders: {
  //   github: {
  //     clientId: process.env.GITHUB_CLIENT_ID!,
  //     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  //   },
  // },
});
```

### Step 3: Mount Better-Auth Route Handler in NestJS
Better-Auth exposes standard web standard request handlers. You can mount it in `AuthController` or via middleware:

In `src/modules/auth/auth.controller.ts`:
```typescript
import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { auth } from './better-auth.instance.js';

@Controller('auth')
export class AuthController {
  @Public()
  @All('*')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    return auth.handler(req, res);
  }
}
```

### Step 4: Validate Sessions in `AuthGuard`
Update `src/modules/auth/auth.guard.ts` to verify session cookies with Better-Auth's native API:

```typescript
import { auth } from './better-auth.instance.js';
import { fromNodeHeaders } from 'better-auth/node';

// Inside canActivate():
const session = await auth.api.getSession({
  headers: fromNodeHeaders(request.headers),
});

if (!session) {
  throw new UnauthorizedException('Invalid or expired session');
}

request.user = session.user;
return true;
```

---

## 3. Frontend Client Integration

On your Next.js, React, or Vue frontend application:
```typescript
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3000/api/v1/auth',
});

// Sign in:
const { data, error } = await authClient.signIn.email({
  email: 'developer@example.com',
  password: 'Password123!',
});

// Get session:
const session = await authClient.useSession();
```

---

## 4. Security Considerations for Better-Auth

1. **Keep `BETTER_AUTH_SECRET` High-Entropy**: Minimum 32 random characters.
2. **CORS Headers**: Ensure frontend origin is included in `CORS_ORIGIN` in `.env`.
3. **Cookie Configuration**: In production (`NODE_ENV=production`), ensure cookies are flagged `Secure` and `SameSite=Lax`.
