/**
 * Application User Roles (E-Commerce Standard Hierarchy)
 *
 * Single Source of Truth (SSOT) for authorization roles across the platform.
 * This file is completely self-contained (zero backend dependencies) so that it can
 * be copied directly to frontend applications (Next.js, React, mobile apps) or shared
 * across microservices to maintain strict type safety and permission parity.
 */

export enum UserRole {
  /**
   * Super Administrator / Platform Owner
   * Unrestricted system-wide access: infrastructure, tenant config, audit logs, billing, staff management.
   */
  SUPER_ADMIN = 'super_admin',

  /**
   * Store Administrator / Operations Manager
   * Global catalog management, order fulfillment, refund approvals, vendor onboarding, analytics.
   */
  ADMIN = 'admin',

  /**
   * Content & Dispute Moderator
   * Review moderation, product compliance/approvals, customer support disputes, ticket handling.
   */
  MODERATOR = 'moderator',

  /**
   * Merchant / Vendor / Seller
   * Storefront management, own product listings, inventory, payout requests, seller orders.
   */
  VENDOR = 'vendor',

  /**
   * Customer / Buyer / End Client
   * Standard shopper: browsing, purchasing, order tracking, writing reviews, profile management.
   */
  CUSTOMER = 'customer',
}

/**
 * Union type representing all valid role strings:
 * 'super_admin' | 'admin' | 'moderator' | 'vendor' | 'customer'
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
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.ADMIN]: 80,
  [UserRole.MODERATOR]: 60,
  [UserRole.VENDOR]: 40,
  [UserRole.CUSTOMER]: 20,
} as const;

/**
 * Human-readable display labels for UI presentation, badges, and dropdowns.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.MODERATOR]: 'Moderator',
  [UserRole.VENDOR]: 'Vendor / Seller',
  [UserRole.CUSTOMER]: 'Customer',
} as const;

/**
 * Type guard to check if an arbitrary string or value is a valid UserRole.
 */
export const isValidRole = (value: unknown): value is UserRole => {
  return (
    typeof value === 'string' &&
    (USER_ROLES as readonly string[]).includes(value)
  );
};

/**
 * Checks whether a user's role meets or exceeds the required hierarchy level.
 */
export const hasMinimumRole = (
  userRole: string | undefined | null,
  requiredRole: UserRole,
): boolean => {
  if (!userRole || !isValidRole(userRole)) {
    return false;
  }
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};
