import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { MIN_ROLE_KEY } from '../decorators/min-role.decorator.js';
import { ALLOW_SELF_KEY } from '../decorators/allow-self.decorator.js';
import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.MODERATOR]: 60,
  [UserRole.VENDOR]: 40,
  [UserRole.CUSTOMER]: 20,
};

/**
 * Guard that verifies whether the authenticated user has sufficient permissions
 * to access an endpoint based on:
 * 1. `@AllowSelf`: Matching the user's ID against the route parameter (e.g. self-profile management).
 * 2. `@Roles(...)`: Exact role matching against a whitelist.
 * 3. `@MinRole(...)`: Hierarchical minimum role level check.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const targetClass = context.getClass();

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [handler, targetClass],
    );

    const minRole = this.reflector.getAllAndOverride<UserRole | undefined>(
      MIN_ROLE_KEY,
      [handler, targetClass],
    );

    const allowSelfParam = this.reflector.getAllAndOverride<string | undefined>(
      ALLOW_SELF_KEY,
      [handler, targetClass],
    );

    // If no RBAC metadata is configured on the handler or class, permit access
    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      !minRole &&
      !allowSelfParam
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as AuthenticatedUser | undefined;

    if (!user || !user.role) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to access this resource.',
      );
    }

    // 1. Check if resource ownership / self-access is permitted
    if (allowSelfParam) {
      const targetParamValue = request.params?.[allowSelfParam];
      if (targetParamValue && targetParamValue === user.id) {
        return true;
      }
    }

    const userRole = user.role as UserRole;

    // 2. Check exact whitelist role requirements
    if (requiredRoles && requiredRoles.length > 0) {
      if (requiredRoles.includes(userRole)) {
        return true;
      }
    }

    // 3. Check hierarchical minimum role requirement
    if (minRole) {
      const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
      const minLevel = ROLE_HIERARCHY[minRole] ?? Infinity;
      if (userLevel >= minLevel) {
        return true;
      }
    }

    // If role criteria failed to match, deny access
    throw new ForbiddenException(
      `Access denied: Insufficient permissions for role '${userRole}'.`,
    );
  }
}
