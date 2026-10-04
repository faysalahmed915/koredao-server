import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const MIN_ROLE_KEY = 'min_role';

/**
 * Decorator to specify the minimum hierarchical UserRole required to access an endpoint or controller.
 * Any role with a hierarchy weight greater than or equal to the specified role will be granted access.
 *
 * @example
 * ```ts
 * @Get('admin/reports')
 * @MinRole(UserRole.ADMIN) // Allows ADMIN and SUPER_ADMIN
 * getReports() { ... }
 * ```
 */
export const MinRole = (role: UserRole) => SetMetadata(MIN_ROLE_KEY, role);
