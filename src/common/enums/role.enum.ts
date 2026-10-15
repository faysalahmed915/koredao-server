/**
 * Application User Roles — derived, never duplicated.
 *
 * This module deliberately **re-exports the Prisma-generated `UserRole`** rather
 * than declaring a parallel enum. A hand-maintained copy previously drifted from
 * the database (lowercase values vs Prisma's uppercase names), which silently
 * broke `isValidRole`/`hasMinimumRole`. Deriving removes that entire class of bug
 * and makes `ROLE_HIERARCHY` / `ROLE_LABELS` compile-checked exhaustively: adding
 * a role to the schema without handling it here becomes a type error.
 *
 * Membership model
 * ----------------
 * `MEMBER` is a *subscription-backed* role layered on top of a user's base role.
 * A user holds MEMBER while they have an `ACTIVE` `Subscription` whose
 * `expiresAt` is in the future; their stored `role` (CUSTOMER / VENDOR / ...) is
 * left untouched. The stored `MEMBER` value therefore does NOT by itself grant
 * paid-marketplace access — see `RolesGuard`.
 */

import { UserRole } from '@prisma/client';

export { UserRole };

/** Union type representing all valid role strings. */
export type Role = `${UserRole}`;

/**
 * Constant list of all roles in array format for validation and iteration.
 */
export const USER_ROLES: readonly UserRole[] = Object.freeze(
  Object.values(UserRole),
);

/**
 * Default role assigned to standard signups / registrations.
 */
export const DEFAULT_ROLE: UserRole = UserRole.CUSTOMER;

/**
 * Numerical hierarchy levels for Role-Based Access Control (RBAC).
 * Higher numerical value represents higher operational privilege.
 *
 * MEMBER (30) sits above CUSTOMER (20) and below VENDOR (40): subscribing widens
 * what a user may *do* on the marketplace without granting unvetted vendor or
 * staff authority.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.MODERATOR]: 60,
  [UserRole.VENDOR]: 40,
  [UserRole.MEMBER]: 30,
  [UserRole.CUSTOMER]: 20,
};

/**
 * Human-readable display labels for UI presentation, badges, and dropdowns.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.MODERATOR]: 'Moderator',
  [UserRole.VENDOR]: 'Vendor / Helper',
  [UserRole.MEMBER]: 'Member',
  [UserRole.CUSTOMER]: 'Customer',
};

/**
 * Roles that are never gated by a paid membership: platform staff must always be
 * able to operate and moderate the marketplace.
 *
 * NOTE: `MEMBER` is intentionally absent. Holding the stored MEMBER role is not
 * proof of payment — only `SubscriptionsService.isActiveMember()` is.
 */
export const MEMBERSHIP_EXEMPT_ROLES: readonly UserRole[] = Object.freeze([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.MODERATOR,
]);

/**
 * Type guard to check if an arbitrary value is a valid UserRole.
 * Accepts any casing so legacy lowercase payloads keep working.
 */
export const isValidRole = (value: unknown): value is UserRole => {
  if (typeof value !== 'string') return false;
  return (USER_ROLES as readonly string[]).includes(value.trim().toUpperCase());
};

/**
 * Normalizes an arbitrary role string to its canonical `UserRole`, or `null`.
 */
export const normalizeRole = (value: unknown): UserRole | null => {
  if (!isValidRole(value)) return null;
  return (value as string).trim().toUpperCase() as UserRole;
};

/**
 * Checks whether a user's role meets or exceeds the required hierarchy level.
 */
export const hasMinimumRole = (
  userRole: string | undefined | null,
  requiredRole: UserRole,
): boolean => {
  const normalized = normalizeRole(userRole);
  if (!normalized) {
    return false;
  }
  return ROLE_HIERARCHY[normalized] >= ROLE_HIERARCHY[requiredRole];
};
