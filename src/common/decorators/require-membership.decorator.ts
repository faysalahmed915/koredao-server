import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MEMBERSHIP_KEY = 'require_membership';

/**
 * Marks an endpoint as a **paid marketplace action** that requires the caller to
 * hold the subscription-backed `MEMBER` role.
 *
 * This is an *additional* gate that stacks on top of `@Roles()` / `@MinRole()`:
 *
 * ```ts
 * @Post()
 * @MinRole(UserRole.VENDOR)       // must be a vetted helper …
 * @RequireMembership()            // … AND have an active membership
 * createGig() { ... }
 * ```
 *
 * Evaluation rules (enforced by `RolesGuard`):
 * - Platform staff (`SUPER_ADMIN`, `ADMIN`, `MODERATOR`) are exempt so operations
 *   and moderation are never blocked by billing.
 * - A user whose stored `role` is literally `MEMBER` passes.
 * - Otherwise the user needs an `ACTIVE`, non-expired `Subscription`.
 *
 * When the caller fails this gate the guard answers `402 Payment Required` so the
 * frontend can distinguish "pay to unlock" from "you are not allowed".
 */
export const RequireMembership = () => SetMetadata(REQUIRE_MEMBERSHIP_KEY, true);
