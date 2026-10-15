import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { MIN_ROLE_KEY } from '../decorators/min-role.decorator.js';
import { ALLOW_SELF_KEY } from '../decorators/allow-self.decorator.js';
import { REQUIRE_MEMBERSHIP_KEY } from '../decorators/require-membership.decorator.js';
import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';
import {
  MEMBERSHIP_EXEMPT_ROLES,
  ROLE_HIERARCHY,
} from '../enums/role.enum.js';
import { SubscriptionsService } from '../../modules/subscriptions/subscriptions.service.js';

/**
 * Guard that verifies whether the authenticated user has sufficient permissions
 * to access an endpoint based on:
 * 1. `@AllowSelf`: Matching the user's ID against the route parameter (e.g. self-profile management).
 * 2. `@Roles(...)`: Exact role matching against a whitelist.
 * 3. `@MinRole(...)`: Hierarchical minimum role level check.
 * 4. `@RequireMembership()`: The subscription-backed `MEMBER` role (paid marketplace actions).
 *
 * The role criteria (1–3) are combined with OR and are evaluated before the
 * membership gate, so a caller who is not allowed at all receives `403` rather
 * than a misleading "pay to unlock" `402`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // RBAC metadata is defined on HTTP controllers. WebSocket gateways do not
    // carry route params / user context in the same shape, so skip them.
    if (context.getType() !== 'http') {
      return true;
    }

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

    const requireMembership = this.reflector.getAllAndOverride<boolean | undefined>(
      REQUIRE_MEMBERSHIP_KEY,
      [handler, targetClass],
    );

    // If no RBAC metadata is configured on the handler or class, permit access
    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      !minRole &&
      !allowSelfParam &&
      !requireMembership
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

    const userRole = user.role as UserRole;

    // 1. Check if resource ownership / self-access is permitted
    if (allowSelfParam && request.params?.[allowSelfParam] === user.id) {
      return true;
    }

    // 2. Role criteria (exact whitelist OR hierarchical minimum).
    const hasRoleCriteria =
      (requiredRoles?.length ?? 0) > 0 || minRole !== undefined;

    let roleSatisfied = !hasRoleCriteria;

    if (requiredRoles && requiredRoles.length > 0) {
      if (requiredRoles.includes(userRole)) {
        roleSatisfied = true;
      }
    }

    if (minRole) {
      const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
      const minLevel = ROLE_HIERARCHY[minRole] ?? Infinity;
      if (userLevel >= minLevel) {
        roleSatisfied = true;
      }
    }

    if (!roleSatisfied) {
      throw new ForbiddenException(
        `Access denied: Insufficient permissions for role '${userRole}'.`,
      );
    }

    // 3. Paid marketplace gate.
    //
    // Only platform staff are exempt. Holding the stored `MEMBER` role is NOT
    // sufficient: that value is admin-assignable and permanent, so trusting it
    // would hand out a lifetime free pass. Membership is always re-derived from
    // an ACTIVE, non-expired subscription.
    if (requireMembership) {
      if (!MEMBERSHIP_EXEMPT_ROLES.includes(userRole)) {
        const isMember = await this.subscriptionsService.isActiveMember(user.id);
        if (!isMember) {
          // 402 lets the client distinguish "pay to unlock" from "forbidden".
          throw new HttpException(
            {
              statusCode: HttpStatus.PAYMENT_REQUIRED,
              error: 'Membership Required',
              message:
                'An active KoreDao membership is required for this action. Subscribe to post jobs and take jobs.',
              code: 'MEMBERSHIP_REQUIRED',
            },
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
      }
    }

    return true;
  }
}
