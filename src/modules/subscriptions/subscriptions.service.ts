import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../core/database/prisma.service.js';
import { randomUUID } from 'node:crypto';
import { NotificationType, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  MEMBERSHIP_PLANS,
  findMembershipPlan,
  type MembershipPlanDefinition,
} from './membership-plans.js';
import type { CheckoutSubscriptionDto, SubscriptionGateway } from './dto/checkout-subscription.dto.js';
import type { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto.js';

export interface MembershipSummary {
  isMember: boolean;
  plan: SubscriptionPlan | null;
  planName: string | null;
  status: SubscriptionStatus | null;
  startedAt: Date | null;
  expiresAt: Date | null;
  daysRemaining: number | null;
  autoRenew: boolean;
  subscriptionId: string | null;
}

export interface CheckoutResult {
  subscriptionId: string;
  plan: SubscriptionPlan;
  planName: string;
  amount: number;
  currency: string;
  durationDays: number;
  gateway: SubscriptionGateway;
  /** Hosted gateway URL the browser should be sent to. `null` in sandbox mode. */
  paymentUrl: string | null;
  /**
   * Our merchant transaction reference. This is the value the payment is bound
   * to and verified against — it is generated server-side and never accepted
   * from the client.
   */
  transactionRef: string | null;
  sandbox: boolean;
  /**
   * When the period *would* end if the membership were confirmed immediately.
   * The clock actually starts at confirmation, so treat this as an estimate.
   */
  expectedExpiresAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MEMBERSHIP_CACHE_TTL_MS = 15_000;
/** How long an unpaid checkout may block starting a new one. */
const PENDING_CHECKOUT_TTL_MS = 60 * 60 * 1000;
/** Upper bound on the membership cache so it can never grow without limit. */
const MEMBERSHIP_CACHE_MAX_ENTRIES = 5_000;

/** Reads a string-ish field from an untrusted gateway response. */
function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Reads a numeric field from an untrusted gateway response. */
function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Compares a gateway-reported major-unit amount to our integer poisha amount. */
function amountMatches(reported: number | null, poisha: number): boolean {
  if (reported === null) return false;
  return Math.abs(reported - poisha / 100) < 0.01;
}

/** Prisma's code for a transaction serialization failure / write conflict. */
function isSerializationFailure(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === 'P2034' || code === 'P2002';
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  /**
   * Short-lived cache of "is this user currently a member".
   *
   * The authorization guard runs on every non-public request, so hitting
   * PostgreSQL each time would add a query to the whole API. The TTL keeps
   * revocation prompt while removing the per-request read, and is additionally
   * clamped to the membership's own expiry so a cached ALLOW can never outlive
   * the subscription it was derived from.
   */
  private readonly membershipCache = new Map<
    string,
    { isMember: boolean; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Catalogue
  // ---------------------------------------------------------------------------

  listPlans(): MembershipPlanDefinition[] {
    return [...MEMBERSHIP_PLANS];
  }

  // ---------------------------------------------------------------------------
  // Membership resolution (authorization hot path)
  // ---------------------------------------------------------------------------

  /**
   * Returns `true` when the user holds an ACTIVE, non-expired membership.
   * Results are cached briefly; see `membershipCache`.
   */
  async isActiveMember(userId: string): Promise<boolean> {
    if (!userId) return false;

    const cached = this.membershipCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.isMember;
    }

    let isMember = false;
    let membershipExpiresAtMs: number | null = null;
    try {
      const active = await this.prisma.subscription.findFirst({
        where: {
          userId,
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, expiresAt: true },
        orderBy: { expiresAt: 'desc' },
      });
      isMember = active !== null;
      membershipExpiresAtMs = active?.expiresAt?.getTime() ?? null;
    } catch (err) {
      // Fail closed: an unreachable database must never be read as "is a member".
      this.logger.error(
        `Membership lookup failed for user ${userId}; denying membership. ${String(err)}`,
      );
      isMember = false;
    }

    // Never let a cached ALLOW outlive the membership it was derived from.
    const ttlExpiry = Date.now() + MEMBERSHIP_CACHE_TTL_MS;
    const expiresAt =
      isMember && membershipExpiresAtMs !== null
        ? Math.min(ttlExpiry, membershipExpiresAtMs)
        : ttlExpiry;

    this.pruneMembershipCache();
    this.membershipCache.set(userId, { isMember, expiresAt });

    return isMember;
  }

  /** Drops expired entries, and the oldest entries if the map still exceeds its cap. */
  private pruneMembershipCache(): void {
    if (this.membershipCache.size < MEMBERSHIP_CACHE_MAX_ENTRIES) return;

    const now = Date.now();
    for (const [key, value] of this.membershipCache) {
      if (value.expiresAt <= now) this.membershipCache.delete(key);
    }

    // Map iterates in insertion order, so the first keys are the oldest.
    while (this.membershipCache.size >= MEMBERSHIP_CACHE_MAX_ENTRIES) {
      const oldest = this.membershipCache.keys().next();
      if (oldest.done) break;
      this.membershipCache.delete(oldest.value);
    }
  }

  /** Drops any cached membership verdict for a user (call after activation/cancel). */
  private invalidateMembership(userId: string): void {
    this.membershipCache.delete(userId);
  }

  /**
   * Full membership state for the current user, suitable for the UI.
   * Also lazily expires overdue subscriptions owned by this user.
   */
  async getMyMembership(userId: string): Promise<MembershipSummary> {
    await this.expireOverdue(userId);

    // Explicitly prefer a live membership over relying on the alphabetical
    // ordering of the status enum, and only fall back to the newest historic
    // row so the UI can still show an expired/cancelled plan.
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const now = Date.now();
    const subscription =
      subscriptions.find(
        (s) =>
          s.status === SubscriptionStatus.ACTIVE &&
          s.expiresAt !== null &&
          s.expiresAt.getTime() > now,
      ) ??
      subscriptions[0] ??
      null;

    if (!subscription) {
      return {
        isMember: false,
        plan: null,
        planName: null,
        status: null,
        startedAt: null,
        expiresAt: null,
        daysRemaining: null,
        autoRenew: false,
        subscriptionId: null,
      };
    }

    const active =
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.expiresAt !== null &&
      subscription.expiresAt.getTime() > Date.now();

    const daysRemaining =
      active && subscription.expiresAt
        ? Math.max(
            0,
            Math.ceil((subscription.expiresAt.getTime() - Date.now()) / DAY_MS),
          )
        : null;

    return {
      isMember: active,
      plan: subscription.plan,
      planName: findMembershipPlan(subscription.plan)?.name ?? subscription.plan,
      status: subscription.status,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      daysRemaining,
      autoRenew: subscription.autoRenew,
      subscriptionId: subscription.id,
    };
  }

  /** Flips this user's overdue ACTIVE rows to EXPIRED so the ledger stays truthful. */
  private async expireOverdue(userId: string): Promise<void> {
    const result = await this.prisma.subscription.updateMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { lte: new Date() },
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });

    if (result.count > 0) {
      this.invalidateMembership(userId);
      this.logger.log(
        `Expired ${result.count} overdue subscription(s) for user ${userId}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Checkout / activation lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Creates a PENDING subscription and (for real gateways) opens a hosted
   * checkout session. Nothing is activated here.
   */
  async checkout(
    userId: string,
    dto: CheckoutSubscriptionDto,
  ): Promise<CheckoutResult> {
    const definition = findMembershipPlan(dto.plan);
    if (!definition) {
      throw new BadRequestException(`Unknown membership plan '${dto.plan}'`);
    }

    const gateway: SubscriptionGateway = dto.gateway ?? 'sandbox';
    this.assertGatewayAllowed(gateway);

    // Refuse to stack a second subscription on top of a live one.
    const existing = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'You already have an active membership. Cancel or let it expire before purchasing another.',
      );
    }

    // At most one in-flight checkout per user. Without this a caller can mint
    // unlimited PENDING rows and confirm several of them, which bills them more
    // than once and makes the "which membership is live?" question ambiguous.
    const pending = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.PENDING },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    if (pending) {
      const ageMs = Date.now() - pending.createdAt.getTime();
      if (ageMs < PENDING_CHECKOUT_TTL_MS) {
        throw new ConflictException(
          'A checkout is already in progress for this account. Complete or abandon it before starting another.',
        );
      }
      // Abandoned checkout (tab closed, gateway never returned) — release it.
      await this.prisma.subscription.update({
        where: { id: pending.id },
        data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
      });
    }

    // Our merchant reference is minted up front and is the key the payment is
    // later verified against. It is never client-supplied and never
    // overwritten, so a caller cannot re-point a payment at another plan.
    const merchantReference = `KD_MEM_${randomUUID()}`;

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        plan: definition.plan,
        status: SubscriptionStatus.PENDING,
        amount: definition.price,
        currency: definition.currency,
        paymentGateway: gateway,
        merchantReference,
      },
    });

    if (gateway === 'sandbox') {
      return {
        subscriptionId: subscription.id,
        plan: definition.plan,
        planName: definition.name,
        amount: definition.price,
        currency: definition.currency,
        durationDays: definition.durationDays,
        gateway,
        paymentUrl: null,
        transactionRef: merchantReference,
        sandbox: true,
        // The period only starts when the membership is confirmed.
        expectedExpiresAt: new Date(Date.now() + definition.durationDays * DAY_MS),
      };
    }

    try {
      const initiation = await this.initiateGatewayCheckout(
        gateway,
        merchantReference,
        definition,
      );

      return {
        subscriptionId: subscription.id,
        plan: definition.plan,
        planName: definition.name,
        amount: definition.price,
        currency: definition.currency,
        durationDays: definition.durationDays,
        gateway,
        paymentUrl: initiation.paymentUrl,
        transactionRef: merchantReference,
        sandbox: false,
        expectedExpiresAt: new Date(Date.now() + definition.durationDays * DAY_MS),
      };
    } catch (err) {
      // Gateway initiation failed — release the PENDING row so the user is not
      // locked out of retrying by the "checkout already in progress" guard.
      await this.prisma.subscription
        .update({
          where: { id: subscription.id },
          data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  /**
   * Confirms a PENDING subscription.
   *
   * The subscription is activated **only** after the gateway has been verified
   * server-side (or, in sandbox mode only, after an explicit non-production
   * confirmation). A client-supplied "it worked" is never sufficient.
   */
  async confirm(
    userId: string,
    dto: ConfirmSubscriptionDto,
  ): Promise<MembershipSummary> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: dto.subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Ownership check before anything else: never leak another user's record.
    if (subscription.userId !== userId) {
      throw new ForbiddenException('You do not own this subscription');
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return this.getMyMembership(userId);
    }

    if (subscription.status !== SubscriptionStatus.PENDING) {
      throw new ConflictException(
        `Subscription is ${subscription.status} and cannot be confirmed`,
      );
    }

    const definition = findMembershipPlan(subscription.plan);
    if (!definition) {
      throw new BadRequestException('Subscription references an unknown plan');
    }

    const gateway = (subscription.paymentGateway ?? 'sandbox') as SubscriptionGateway;
    this.assertGatewayAllowed(gateway);

    // The payment is always verified against the server-stored merchant
    // reference; a client-supplied reference is deliberately ignored so a cheap
    // payment cannot be replayed against an expensive plan.
    const verified = await this.verifyWithGateway(gateway, subscription);
    if (!verified.success) {
      throw new ConflictException(
        verified.reason || 'Payment could not be verified with the gateway',
      );
    }

    const activated = await this.activate(
      subscription,
      definition,
      verified.gatewayReference,
    );

    if (!activated) {
      this.logger.warn(
        `Subscription ${subscription.id} was already confirmed by a concurrent request`,
      );
    } else {
      this.logger.log(
        `Membership activated for user ${userId} (${definition.plan})`,
      );
    }

    this.invalidateMembership(userId);
    return this.getMyMembership(userId);
  }

  /**
   * Activates a PENDING subscription while preserving the platform invariant
   * that a user holds **at most one ACTIVE membership**.
   *
   * Runs at `Serializable` so two concurrent confirmations cannot both observe
   * "no other live membership" and commit; Postgres aborts one of them
   * (`P2034`), which we treat as "already activated". Any pre-existing live
   * membership is superseded and its unused time carried over, so a duplicate
   * purchase is never silently confiscated.
   *
   * @returns `true` when this call performed the activation, `false` when a
   *          concurrent request already did (or the row was no longer PENDING).
   */
  private async activate(
    subscription: { id: string; userId: string },
    definition: MembershipPlanDefinition,
    gatewayReference?: string,
  ): Promise<boolean> {
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Re-check inside the transaction: the caller's earlier read is stale.
          const current = await tx.subscription.findUnique({
            where: { id: subscription.id },
            select: { status: true },
          });
          if (current?.status !== SubscriptionStatus.PENDING) {
            return { count: 0 };
          }

          const now = Date.now();
          const superseded = await tx.subscription.findMany({
            where: {
              userId: subscription.userId,
              id: { not: subscription.id },
              status: SubscriptionStatus.ACTIVE,
              expiresAt: { gt: new Date(now) },
            },
            select: { id: true, expiresAt: true },
            orderBy: { expiresAt: 'desc' },
          });

          // Carry over any remaining paid time so nothing the user paid for is lost.
          const carryOverFrom = superseded[0]?.expiresAt;
          const startsAtMs =
            carryOverFrom && carryOverFrom.getTime() > now
              ? carryOverFrom.getTime()
              : now;

          if (superseded.length > 0) {
            this.logger.warn(
              `Superseding ${superseded.length} live membership(s) for user ${subscription.userId} on activation of ${subscription.id}`,
            );
            await tx.subscription.updateMany({
              where: { id: { in: superseded.map((s) => s.id) } },
              data: {
                status: SubscriptionStatus.EXPIRED,
                autoRenew: false,
                cancelledAt: new Date(),
              },
            });
          }

          return tx.subscription.updateMany({
            where: { id: subscription.id, status: SubscriptionStatus.PENDING },
            data: {
              status: SubscriptionStatus.ACTIVE,
              startedAt: new Date(startsAtMs),
              expiresAt: new Date(startsAtMs + definition.durationDays * DAY_MS),
              // Our merchant reference stays intact; the gateway's own id is
              // recorded separately for the ledger and support.
              ...(gatewayReference ? { paymentReference: gatewayReference } : {}),
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );

      if (result.count > 0 && subscription.userId) {
        this.invalidateMembership(subscription.userId);
        // Membership is a paid moment the user must see confirmed.
        await this.notifications.safeNotify(subscription.userId, {
          type: NotificationType.MEMBERSHIP,
          title: 'Membership activated',
          body: `${definition.name} is active — posting jobs and other member benefits are unlocked.`,
          link: '/membership',
        });
      }

      return result.count > 0;
    } catch (err) {
      // A serialization failure means a concurrent confirmation won the race.
      if (isSerializationFailure(err)) {
        this.logger.warn(
          `Concurrent activation detected for subscription ${subscription.id}; treating as already activated`,
        );
        return false;
      }
      throw err;
    }
  }

  /**
   * Handles a gateway redirect/callback (unauthenticated by nature, because the
   * browser arrives from the gateway).
   *
   * Safety comes from *server-side verification*: the subscription is only
   * activated when the gateway itself confirms the payment. Knowing a
   * subscription id is therefore not enough to obtain a membership.
   */
  async handleGatewayCallback(
    gateway: SubscriptionGateway,
    merchantReference: string,
  ): Promise<{ activated: boolean; returnUrl: string; reason?: string }> {
    const membershipReturnUrl = this.config.get<string>(
      'payment.membershipReturnUrl',
      'http://localhost:3001/membership',
    );

    // Looked up by OUR merchant reference, which is what the gateway was given
    // and what the payment is bound to.
    const subscription = await this.prisma.subscription.findUnique({
      where: { merchantReference },
    });

    if (!subscription || subscription.paymentGateway !== gateway) {
      return { activated: false, returnUrl: membershipReturnUrl, reason: 'unknown_subscription' };
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return { activated: true, returnUrl: membershipReturnUrl };
    }

    if (subscription.status !== SubscriptionStatus.PENDING) {
      return { activated: false, returnUrl: membershipReturnUrl, reason: 'not_pending' };
    }

    const definition = findMembershipPlan(subscription.plan);
    if (!definition) {
      return { activated: false, returnUrl: membershipReturnUrl, reason: 'unknown_plan' };
    }

    const verified = await this.verifyWithGateway(gateway, subscription);
    if (!verified.success) {
      return {
        activated: false,
        returnUrl: membershipReturnUrl,
        reason: 'unverified',
      };
    }

    const activated = await this.activate(subscription, definition, verified.gatewayReference);

    if (!activated) {
      this.logger.warn(
        `Subscription ${subscription.id} was already activated by a concurrent callback`,
      );
      return { activated: true, returnUrl: membershipReturnUrl };
    }

    this.logger.log(
      `Membership activated via ${gateway} callback for user ${subscription.userId} (${definition.plan})`,
    );
    return { activated: true, returnUrl: membershipReturnUrl };
  }

  /**
   * Cancels the caller's own subscription. Membership remains valid until the
   * paid period actually ends, so users are never cut off mid-cycle.
   */
  async cancelMine(userId: string): Promise<MembershipSummary> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('No active membership to cancel');
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { autoRenew: false, cancelledAt: new Date() },
    });

    this.invalidateMembership(userId);
    return this.getMyMembership(userId);
  }

  // ---------------------------------------------------------------------------
  // Gateway adapters
  // ---------------------------------------------------------------------------

  /**
   * Sandbox checkout exists purely for local development.
   *
   * **Default deny**: it is enabled only for an explicit development/test
   * environment, or when an operator deliberately opts in. Previously anything
   * that was not literally `NODE_ENV=production` (staging, demo, a host that
   * forgot to set NODE_ENV) would hand out free memberships.
   */
  private isSandboxEnabled(): boolean {
    if (process.env.ALLOW_MEMBERSHIP_SANDBOX === 'true') return true;

    const env = process.env.NODE_ENV;
    return env === 'development' || env === 'test';
  }

  private assertGatewayAllowed(gateway: SubscriptionGateway): void {
    if (gateway === 'sandbox' && !this.isSandboxEnabled()) {
      throw new ForbiddenException(
        'Sandbox membership checkout is disabled on this deployment.',
      );
    }
  }

  private async initiateGatewayCheckout(
    gateway: Exclude<SubscriptionGateway, 'sandbox'>,
    merchantReference: string,
    definition: MembershipPlanDefinition,
  ): Promise<{ paymentUrl: string }> {
    const serverBaseUrl =
      process.env.APP_URL ||
      `http://localhost:${this.config.get<number>('app.port', 3000)}`;
    const apiPrefix = this.config.get<string>('app.apiPrefix', 'api/v1');
    const callbackUrl = `${serverBaseUrl}/${apiPrefix}/subscriptions/${gateway}/callback`;

    if (gateway === 'aamarpay') {
      const payload = {
        store_id: this.config.get<string>('payment.aamarpay.storeId', 'aamarpaytest'),
        signature_key: this.config.get<string>(
          'payment.aamarpay.signatureKey',
          '',
        ),
        tran_id: merchantReference,
        amount: (definition.price / 100).toFixed(2),
        currency: definition.currency,
        desc: `KoreDao ${definition.name}`,
        cus_name: 'KoreDao Member',
        cus_email: 'member@koredao.com',
        cus_phone: '01700000000',
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
        success_url: `${callbackUrl}?subscriptionId=${merchantReference}`,
        fail_url: `${callbackUrl}?subscriptionId=${merchantReference}`,
        cancel_url: `${callbackUrl}?subscriptionId=${merchantReference}`,
        type: 'json',
        opt_a: merchantReference,
      };

      const res = await this.postJson(
        this.config.get<string>('payment.aamarpay.initiateUrl', ''),
        payload,
      );

      const paymentUrl = asString(res?.payment_url);
      if (!paymentUrl) {
        throw new ServiceUnavailableException(
          'Aamarpay checkout could not be started. Please try again or use another gateway.',
        );
      }
      return { paymentUrl };
    }

    // PipraPay
    const payload = {
      merchant_id: this.config.get<string>('payment.piprapay.merchantId', ''),
      amount: definition.price / 100,
      currency: definition.currency,
      order_id: merchantReference,
      customer_name: 'KoreDao Member',
      customer_email: 'member@koredao.com',
      customer_phone: '01700000000',
      callback_url: `${callbackUrl}?subscriptionId=${merchantReference}`,
      return_url: `${callbackUrl}?subscriptionId=${merchantReference}`,
    };

    const res = await this.postJson(
      this.config.get<string>('payment.piprapay.initiateUrl', ''),
      payload,
      { 'X-API-KEY': this.config.get<string>('payment.piprapay.apiKey', '') },
    );

    const paymentUrl = asString(res?.payment_url) ?? asString(res?.redirect_url);
    if (!paymentUrl) {
      throw new ServiceUnavailableException(
        'PipraPay checkout could not be started. Please try again or use another gateway.',
      );
    }
    return { paymentUrl };
  }

  /**
   * Server-to-server verification. Fails closed: any error, timeout or ambiguous
   * gateway response results in "not verified" and the membership is not granted.
   *
   * The lookup key is **always** our own `merchantReference` — never a
   * client-supplied value — and the amount actually paid must match the plan the
   * subscription was created for, so a cheap payment cannot be replayed against
   * an expensive plan.
   */
  private async verifyWithGateway(
    gateway: SubscriptionGateway,
    subscription: {
      id: string;
      merchantReference: string | null;
      amount: number;
      currency: string;
    },
  ): Promise<{ success: boolean; gatewayReference?: string; reason?: string }> {
    if (gateway === 'sandbox') {
      if (!this.isSandboxEnabled()) {
        return { success: false, reason: 'Sandbox confirmation is disabled' };
      }
      return {
        success: true,
        gatewayReference: `SANDBOX_MEMBERSHIP_${subscription.id}`,
      };
    }

    // Every real gateway is verified against OUR merchant reference. A
    // client-supplied reference is never trusted: it is the one value an
    // attacker controls on this path.
    const merchantReference = subscription.merchantReference;
    if (!merchantReference) {
      this.logger.error(
        `Subscription ${subscription.id} has no merchant reference; cannot verify`,
      );
      return {
        success: false,
        reason: 'This checkout cannot be verified. Please contact support.',
      };
    }

    if (gateway === 'aamarpay') {
      const rawVerifyUrl = this.config.get<string>(
        'payment.aamarpay.verifyUrl',
        '',
      );
      let verifyUrl: URL;
      try {
        verifyUrl = new URL(rawVerifyUrl);
      } catch {
        // A missing/malformed endpoint must fail closed, never throw a 500.
        this.logger.error(
          'Aamarpay verification endpoint is not configured correctly',
        );
        return {
          success: false,
          reason: 'Aamarpay verification is unavailable on this deployment',
        };
      }

      verifyUrl.searchParams.set('request_id', merchantReference);
      verifyUrl.searchParams.set(
        'store_id',
        this.config.get<string>('payment.aamarpay.storeId', ''),
      );
      verifyUrl.searchParams.set(
        'signature_key',
        this.config.get<string>('payment.aamarpay.signatureKey', ''),
      );
      verifyUrl.searchParams.set('type', 'json');

      try {
        const response = await fetch(verifyUrl.toString(), {
          method: 'GET',
          signal: AbortSignal.timeout(10_000),
        });
        const body = (await response.json()) as Record<string, unknown>;

        // `status_code` describes the *transaction-check request*, not whether
        // the customer paid, so only `pay_status` may authorise a membership.
        if (body?.pay_status !== 'Successful') {
          return { success: false, reason: 'Aamarpay reports the payment as unpaid' };
        }

        if (!amountMatches(asNumber(body?.amount), subscription.amount)) {
          this.logger.error(
            `Aamarpay amount mismatch for ${merchantReference}: expected ${subscription.amount / 100} ${subscription.currency}, got ${String(body?.amount)}`,
          );
          return {
            success: false,
            reason: 'The paid amount does not match the selected plan',
          };
        }

        return {
          success: true,
          gatewayReference: asString(body?.pg_txnid) ?? merchantReference,
        };
      } catch (err) {
        this.logger.error(`Aamarpay verification failed: ${String(err)}`);
        return { success: false, reason: 'Could not reach the payment gateway' };
      }
    }

    // PipraPay
    try {
      const response = await fetch(
        this.config.get<string>('payment.piprapay.verifyUrl', ''),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': this.config.get<string>('payment.piprapay.apiKey', ''),
          },
          body: JSON.stringify({
            merchant_id: this.config.get<string>('payment.piprapay.merchantId', ''),
            order_id: merchantReference,
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const body = (await response.json()) as Record<string, unknown>;

      const paid =
        body?.status === 'COMPLETED' ||
        body?.status === 'SUCCESS' ||
        body?.payment_status === 'completed';
      if (!paid) {
        return { success: false, reason: 'PipraPay reports the payment as unpaid' };
      }

      if (!amountMatches(asNumber(body?.amount), subscription.amount)) {
        this.logger.error(
          `PipraPay amount mismatch for ${merchantReference}: expected ${subscription.amount / 100} ${subscription.currency}, got ${String(body?.amount)}`,
        );
        return {
          success: false,
          reason: 'The paid amount does not match the selected plan',
        };
      }

      return {
        success: true,
        gatewayReference: asString(body?.pp_txnid) ?? merchantReference,
      };
    } catch (err) {
      this.logger.error(`PipraPay verification failed: ${String(err)}`);
      return { success: false, reason: 'Could not reach the payment gateway' };
    }
  }

  /**
   * Gateway-response shape. Responses are untrusted, so every field is read
   * defensively via {@link asString} rather than assumed.
   */
  private async postJson(
    url: string,
    payload: Record<string, unknown>,
    extraHeaders: Record<string, string> = {},
  ): Promise<Record<string, unknown> | null> {
    if (!url) return null;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      const text = await response.text();
      try {
        const parsed: unknown = JSON.parse(text);
        return parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        this.logger.warn(`Gateway returned a non-JSON body from ${url}`);
        return null;
      }
    } catch (err) {
      this.logger.error(`Gateway checkout initiation failed for ${url}: ${String(err)}`);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Admin / operational helpers
  // ---------------------------------------------------------------------------

  /**
   * Grants a membership without payment. Used by seeding, comps and support
   * recovery. Never reachable from a public route.
   */
  async grantMembership(
    userId: string,
    plan: SubscriptionPlan = SubscriptionPlan.MEMBER_MONTHLY,
  ): Promise<void> {
    const definition = findMembershipPlan(plan);
    if (!definition) {
      throw new BadRequestException(`Unknown membership plan '${plan}'`);
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + definition.durationDays * DAY_MS);

    await this.prisma.subscription.create({
      data: {
        userId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        amount: 0,
        currency: definition.currency,
        paymentGateway: 'COMPED',
        paymentReference: `COMP_${randomUUID()}`,
        merchantReference: `KD_COMP_${randomUUID()}`,
        startedAt,
        expiresAt,
      },
    });

    this.invalidateMembership(userId);
  }
}
