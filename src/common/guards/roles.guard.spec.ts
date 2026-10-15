import {
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { MIN_ROLE_KEY } from '../decorators/min-role.decorator.js';
import { ALLOW_SELF_KEY } from '../decorators/allow-self.decorator.js';
import { REQUIRE_MEMBERSHIP_KEY } from '../decorators/require-membership.decorator.js';
import { UserRole } from '@prisma/client';
import type { SubscriptionsService } from '../../modules/subscriptions/subscriptions.service.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let subscriptions: { isActiveMember: ReturnType<typeof vi.fn> };

  const createMockContext = (
    user?: { id: string; role?: string },
    params: Record<string, string> = {},
  ): ExecutionContext => {
    return {
      getType: () => 'http',
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };
    subscriptions = {
      isActiveMember: vi.fn().mockResolvedValue(false),
    };
    guard = new RolesGuard(
      reflector as unknown as Reflector,
      subscriptions as unknown as SubscriptionsService,
    );
  });

  it('should allow access if no RBAC metadata is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = createMockContext({ id: 'user-1', role: UserRole.CUSTOMER });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('should skip RBAC enforcement for non-HTTP (WebSocket) contexts', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === ROLES_KEY) return [UserRole.ADMIN];
      return undefined;
    });

    const wsContext = {
      getType: () => 'ws',
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToWs: () => ({
        getClient: vi.fn(),
        getData: vi.fn(),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(wsContext)).resolves.toBe(true);
  });

  it('should throw ForbiddenException if user is not authenticated or lacks a role', async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === ROLES_KEY) return [UserRole.ADMIN];
      return undefined;
    });

    const ctxWithoutUser = createMockContext(undefined);
    await expect(guard.canActivate(ctxWithoutUser)).rejects.toThrow(ForbiddenException);

    const ctxWithoutRole = createMockContext({ id: 'u1' });
    await expect(guard.canActivate(ctxWithoutRole)).rejects.toThrow(ForbiddenException);
  });

  describe('Whitelist checking with @Roles', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === ROLES_KEY) return [UserRole.ADMIN, UserRole.SUPER_ADMIN];
        return undefined;
      });
    });

    it('should allow user possessing an allowed role', async () => {
      const ctx = createMockContext({ id: 'u1', role: UserRole.ADMIN });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('should deny user lacking an allowed role', async () => {
      const ctx = createMockContext({ id: 'u1', role: UserRole.CUSTOMER });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Hierarchy checking with @MinRole', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === MIN_ROLE_KEY) return UserRole.ADMIN;
        return undefined;
      });
    });

    it('should allow SUPER_ADMIN when minimum required role is ADMIN', async () => {
      const ctx = createMockContext({ id: 'u1', role: UserRole.SUPER_ADMIN });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('should allow ADMIN when minimum required role is ADMIN', async () => {
      const ctx = createMockContext({ id: 'u1', role: UserRole.ADMIN });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('should deny VENDOR or CUSTOMER when minimum required role is ADMIN', async () => {
      const ctxVendor = createMockContext({ id: 'u1', role: UserRole.VENDOR });
      await expect(guard.canActivate(ctxVendor)).rejects.toThrow(ForbiddenException);

      const ctxCustomer = createMockContext({ id: 'u2', role: UserRole.CUSTOMER });
      await expect(guard.canActivate(ctxCustomer)).rejects.toThrow(ForbiddenException);
    });

    it('should treat MEMBER as above CUSTOMER but below VENDOR', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === MIN_ROLE_KEY) return UserRole.MEMBER;
        return undefined;
      });

      const ctx = createMockContext({ id: 'u3', role: UserRole.MEMBER });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);

      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === MIN_ROLE_KEY) return UserRole.VENDOR;
        return undefined;
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Self ownership with @AllowSelf', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === MIN_ROLE_KEY) return UserRole.ADMIN;
        if (key === ALLOW_SELF_KEY) return 'id';
        return undefined;
      });
    });

    it('should allow CUSTOMER to access their own resource when params.id matches user.id', async () => {
      const ctx = createMockContext(
        { id: 'user-123', role: UserRole.CUSTOMER },
        { id: 'user-123' },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('should deny CUSTOMER trying to access another user resource when params.id does not match', async () => {
      const ctx = createMockContext(
        { id: 'user-123', role: UserRole.CUSTOMER },
        { id: 'user-456' },
      );
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to access any user resource even when params.id does not match', async () => {
      const ctx = createMockContext(
        { id: 'admin-1', role: UserRole.ADMIN },
        { id: 'user-456' },
      );
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('Paid marketplace gate with @RequireMembership', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === REQUIRE_MEMBERSHIP_KEY) return true;
        return undefined;
      });
    });

    it('denies with 402 when the caller has no active membership', async () => {
      subscriptions.isActiveMember.mockResolvedValue(false);
      const ctx = createMockContext({ id: 'u1', role: UserRole.CUSTOMER });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.PAYMENT_REQUIRED,
      });
      expect(subscriptions.isActiveMember).toHaveBeenCalledWith('u1');
    });

    it('allows the caller when an active membership exists', async () => {
      subscriptions.isActiveMember.mockResolvedValue(true);
      const ctx = createMockContext({ id: 'u1', role: UserRole.CUSTOMER });

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('does NOT trust the stored MEMBER role without an active subscription', async () => {
      subscriptions.isActiveMember.mockResolvedValue(false);
      const ctx = createMockContext({ id: 'u1', role: UserRole.MEMBER });

      // The stored role is admin-assignable and permanent, so it must not be a
      // lifetime bypass of the paid gate.
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.PAYMENT_REQUIRED,
      });
      expect(subscriptions.isActiveMember).toHaveBeenCalledWith('u1');
    });

    it('allows the MEMBER role when the subscription is active', async () => {
      subscriptions.isActiveMember.mockResolvedValue(true);
      const ctx = createMockContext({ id: 'u1', role: UserRole.MEMBER });

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(subscriptions.isActiveMember).toHaveBeenCalledWith('u1');
    });

    it('exempts platform staff from the paid gate', async () => {
      for (const role of [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MODERATOR]) {
        const ctx = createMockContext({ id: `${role}-1`, role });
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
      }
      expect(subscriptions.isActiveMember).not.toHaveBeenCalled();
    });

    it('prefers 403 over 402 when the caller is not allowed at all', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === REQUIRE_MEMBERSHIP_KEY) return true;
        if (key === ROLES_KEY) return [UserRole.CUSTOMER];
        return undefined;
      });

      const ctx = createMockContext({ id: 'u1', role: UserRole.VENDOR });

      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
      expect(subscriptions.isActiveMember).not.toHaveBeenCalled();
    });
  });
});
