import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { MIN_ROLE_KEY } from '../decorators/min-role.decorator.js';
import { ALLOW_SELF_KEY } from '../decorators/allow-self.decorator.js';
import { UserRole } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  const createMockContext = (
    user?: { id: string; role?: string },
    params: Record<string, string> = {},
  ): ExecutionContext => {
    return {
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
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('should allow access if no RBAC metadata is present', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = createMockContext({ id: 'user-1', role: UserRole.CUSTOMER });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException if user is not authenticated or lacks a role', () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === ROLES_KEY) return [UserRole.ADMIN];
      return undefined;
    });

    const ctxWithoutUser = createMockContext(undefined);
    expect(() => guard.canActivate(ctxWithoutUser)).toThrow(ForbiddenException);

    const ctxWithoutRole = createMockContext({ id: 'u1' });
    expect(() => guard.canActivate(ctxWithoutRole)).toThrow(ForbiddenException);
  });

  describe('Whitelist checking with @Roles', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === ROLES_KEY) return [UserRole.ADMIN, UserRole.SUPER_ADMIN];
        return undefined;
      });
    });

    it('should allow user possessing an allowed role', () => {
      const ctx = createMockContext({ id: 'u1', role: UserRole.ADMIN });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should deny user lacking an allowed role', () => {
      const ctx = createMockContext({ id: 'u1', role: UserRole.CUSTOMER });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('Hierarchy checking with @MinRole', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === MIN_ROLE_KEY) return UserRole.ADMIN;
        return undefined;
      });
    });

    it('should allow SUPER_ADMIN when minimum required role is ADMIN', () => {
      const ctx = createMockContext({ id: 'u1', role: UserRole.SUPER_ADMIN });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow ADMIN when minimum required role is ADMIN', () => {
      const ctx = createMockContext({ id: 'u1', role: UserRole.ADMIN });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should deny VENDOR or CUSTOMER when minimum required role is ADMIN', () => {
      const ctxVendor = createMockContext({ id: 'u1', role: UserRole.VENDOR });
      expect(() => guard.canActivate(ctxVendor)).toThrow(ForbiddenException);

      const ctxCustomer = createMockContext({ id: 'u2', role: UserRole.CUSTOMER });
      expect(() => guard.canActivate(ctxCustomer)).toThrow(ForbiddenException);
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

    it('should allow CUSTOMER to access their own resource when params.id matches user.id', () => {
      const ctx = createMockContext(
        { id: 'user-123', role: UserRole.CUSTOMER },
        { id: 'user-123' },
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should deny CUSTOMER trying to access another user resource when params.id does not match', () => {
      const ctx = createMockContext(
        { id: 'user-123', role: UserRole.CUSTOMER },
        { id: 'user-456' },
      );
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should allow ADMIN to access any user resource even when params.id does not match', () => {
      const ctx = createMockContext(
        { id: 'admin-1', role: UserRole.ADMIN },
        { id: 'user-456' },
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
