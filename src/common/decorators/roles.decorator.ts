import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which UserRoles are permitted to access an endpoint or controller.
 *
 * @example
 * ```ts
 * @Get('admin/dashboard')
 * @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 * getDashboard() { ... }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
