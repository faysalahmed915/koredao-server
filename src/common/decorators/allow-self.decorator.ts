import { SetMetadata } from '@nestjs/common';

export const ALLOW_SELF_KEY = 'allow_self';

/**
 * Decorator to grant access to the authenticated user if their user ID matches
 * the route parameter value (default: 'id').
 *
 * Can be combined with `@MinRole(...)` or `@Roles(...)` so that either resource owners
 * or privileged staff (e.g. admins) are allowed to access the endpoint.
 *
 * @param paramKey The name of the route parameter to compare with `user.id`. Defaults to `'id'`.
 *
 * @example
 * ```ts
 * @Get(':id')
 * @MinRole(UserRole.ADMIN)
 * @AllowSelf('id')
 * getUser(@Param('id') id: string) { ... }
 * ```
 */
export const AllowSelf = (paramKey: string = 'id') =>
  SetMetadata(ALLOW_SELF_KEY, paramKey);
