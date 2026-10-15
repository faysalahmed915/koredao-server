/**
 * Application User Roles (Single Source of Truth)
 *
 * Values intentionally mirror the Prisma `UserRole` enum *names* exactly, so a
 * role string read from the database, from a Better-Auth session, or from a
 * frontend payload is always valid here without any case coercion.
 *
 * Membership model
 * ----------------
 * `MEMBER` is a *subscription-backed* role that is layered on top of a user's
 * base role. A user holds MEMBER while they have an `ACTIVE` `Subscription`
 * whose `expiresAt` is in the future; they keep their base role (CUSTOMER /
 * VENDOR / ...) unchanged. See `ROLE_HIERARCHY` for how MEMBER ranks.
 */

export enum UserRole {
  /**
   * Super Administrator / Platform Owner
   * Unrestricted system-wide access: infrastructure, tenant config, audit logs, billing, staff management.
   */
  SUPER_ADMIN = 'SUPER_ADMIN',

  /**
   * Platform Administrator / Operations Manager
   * Catalog management, order fulfillment, refund approvals, vendor onboarding, analytics.
   */
  ADMIN = 'ADMIN',

  /**
   * Content & Dispute Moderator
   * Review moderation, compliance approvals, customer support disputes, ticket handling.
   */
  MODERATOR = 'MODERATOR',

  /**
   * Merchant / Helper / Seller
   * Storefront management, own service listings, inventory, payout requests, seller orders.
   */
  VENDOR = 'VENDOR',

  /**
   * Subscribed Member (paid)
   * Granted by an ACTIVE subscription on top of the base role. Required for the
   * paid marketplace actions: posting a job and taking a job.
   */
  MEMBER = 'MEMBER',

  /**
   * Customer / Buyer / Client
   * Standard account: browsing, purchasing, order tracking, reviews, profile management.
   */
  CUSTOMER = 'CUSTOMER',
}

/**
 * Union type representing all valid role strings:
 * 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'VENDOR' | 'MEMBER' | 'CUSTOMER'
 */
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
 * MEMBER (30) deliberately sits above CUSTOMER (20) and below VENDOR (40):
 * subscribing upgrades what a user may *do* on the marketplace, but it must
 * never grant vendor/staff authority they were not vetted for.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.MODERATOR]: 60,
  [UserRole.VENDOR]: 40,
  [UserRole.MEMBER]: 30,
  [UserRole.CUSTOMER]: 20,
} as const;

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
} as const;

/**
 * Roles that are never gated by a paid membership: platform staff must always be
 * able to operate and moderate the marketplace.
 *
 * Typed as the literal-union `Role` (not the `UserRole` enum) so it composes
 * directly with the Prisma-generated `UserRole` union without a cast.
 */
export const MEMBERSHIP_EXEMPT_ROLES: readonly Role[] = Object.freeze([
  'SUPER_ADMIN',
  'ADMIN',
  'MODERATOR',
] as const);

/**
 * Type guard to check if an arbitrary string or value is a valid UserRole.
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
