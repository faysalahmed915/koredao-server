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
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
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
  /** Gateway-assigned merchant transaction reference, when the gateway returned one. */
  transactionRef: string | null;
  sandbox: boolean;
  expiresAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MEMBERSHIP_CACHE_TTL_MS = 15_000;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  /**
   * Short-lived cache of "is this user currently a member".
   *
   * The authorization guard runs on every non-public request, so hitting
   * PostgreSQL each time would add a query to the whole API. A 15 second TTL
   * keeps revocation prompt (an admin cancelling a subscription is effective
   * almost immediately) while removing the per-request read.
   */
  private readonly membershipCache = new Map<
    string,
    { isMember: boolean; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
    try {
      const active = await this.prisma.subscription.findFirst({
        where: {
          userId,
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      isMember = active !== null;
    } catch (err) {
      // Fail closed: an unreachable database must never be read as "is a member".
      this.logger.error(
        `Membership lookup failed for user ${userId}; denying membership. ${String(err)}`,
      );
      isMember = false;
    }

    this.membershipCache.set(userId, {
      isMember,
      expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS,
    });

    return isMember;
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

    const subscription = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

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

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        plan: definition.plan,
        status: SubscriptionStatus.PENDING,
        amount: definition.price,
        currency: definition.currency,
        paymentGateway: gateway,
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
        transactionRef: null,
        sandbox: true,
        expiresAt: new Date(Date.now() + definition.durationDays * DAY_MS),
      };
    }

    const initiation = await this.initiateGatewayCheckout(
      gateway,
      subscription.id,
      definition,
    );

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { paymentReference: initiation.transactionRef },
    });

    return {
      subscriptionId: subscription.id,
      plan: definition.plan,
      planName: definition.name,
      amount: definition.price,
      currency: definition.currency,
      durationDays: definition.durationDays,
      gateway,
      paymentUrl: initiation.paymentUrl,
      transactionRef: initiation.transactionRef,
      sandbox: false,
      expiresAt: new Date(Date.now() + definition.durationDays * DAY_MS),
    };
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

    const verified = await this.verifyWithGateway(gateway, subscription, dto.reference);
    if (!verified.success) {
      throw new ConflictException(
        verified.reason || 'Payment could not be verified with the gateway',
      );
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + definition.durationDays * DAY_MS);

    const activated = await this.prisma.subscription.updateMany({
      // Guarded update keeps this idempotent under concurrent callbacks.
      where: { id: subscription.id, status: SubscriptionStatus.PENDING },
      data: {
        status: SubscriptionStatus.ACTIVE,
        startedAt,
        expiresAt,
        ...(verified.reference ? { paymentReference: verified.reference } : {}),
      },
    });

    if (activated.count === 0) {
      this.logger.warn(
        `Subscription ${subscription.id} was already confirmed by a concurrent request`,
      );
    } else {
      this.logger.log(
        `Membership activated for user ${userId} (${definition.plan}) until ${expiresAt.toISOString()}`,
      );
    }

    this.invalidateMembership(userId);
    return this.getMyMembership(userId);
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
    subscriptionId: string,
    reference?: string,
  ): Promise<{ activated: boolean; returnUrl: string; reason?: string }> {
    const returnUrl = this.config.get<string>(
      'payment.returnUrl',
      'http://localhost:3001/membership',
    );
    const membershipReturnUrl = returnUrl.replace(/\/orders.*$/, '/membership');

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
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

    const verified = await this.verifyWithGateway(gateway, subscription, reference);
    if (!verified.success) {
      return {
        activated: false,
        returnUrl: membershipReturnUrl,
        reason: 'unverified',
      };
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + definition.durationDays * DAY_MS);

    await this.prisma.subscription.updateMany({
      where: { id: subscription.id, status: SubscriptionStatus.PENDING },
      data: {
        status: SubscriptionStatus.ACTIVE,
        startedAt,
        expiresAt,
        ...(verified.reference ? { paymentReference: verified.reference } : {}),
      },
    });

    this.invalidateMembership(subscription.userId);
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
   * Sandbox checkout exists purely for local development. It is refused outright
   * in production so a misconfigured deployment can never hand out free memberships.
   */
  private isSandboxEnabled(): boolean {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MEMBERSHIP_SANDBOX !== 'true') {
      return false;
    }
    return true;
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
    subscriptionId: string,
    definition: MembershipPlanDefinition,
  ): Promise<{ paymentUrl: string; transactionRef: string }> {
    const transactionRef = `KD_MEM_${subscriptionId}_${Date.now().toString(36)}`;
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
        tran_id: transactionRef,
        amount: (definition.price / 100).toFixed(2),
        currency: definition.currency,
        desc: `KoreDao ${definition.name}`,
        cus_name: 'KoreDao Member',
        cus_email: 'member@koredao.com',
        cus_phone: '01700000000',
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
        success_url: `${callbackUrl}?subscriptionId=${subscriptionId}`,
        fail_url: `${callbackUrl}?subscriptionId=${subscriptionId}`,
        cancel_url: `${callbackUrl}?subscriptionId=${subscriptionId}`,
        type: 'json',
        opt_a: subscriptionId,
      };

      const res = await this.postJson(
        this.config.get<string>('payment.aamarpay.initiateUrl', ''),
        payload,
      );

      const paymentUrl = res?.payment_url as string | undefined;
      if (!paymentUrl) {
        throw new ServiceUnavailableException(
          'Aamarpay checkout could not be started. Please try again or use another gateway.',
        );
      }
      return { paymentUrl, transactionRef };
    }

    // PipraPay
    const payload = {
      merchant_id: this.config.get<string>('payment.piprapay.merchantId', ''),
      amount: definition.price / 100,
      currency: definition.currency,
      order_id: transactionRef,
      customer_name: 'KoreDao Member',
      customer_email: 'member@koredao.com',
      customer_phone: '01700000000',
      callback_url: `${callbackUrl}?subscriptionId=${subscriptionId}`,
      return_url: `${callbackUrl}?subscriptionId=${subscriptionId}`,
    };

    const res = await this.postJson(
      this.config.get<string>('payment.piprapay.initiateUrl', ''),
      payload,
      { 'X-API-KEY': this.config.get<string>('payment.piprapay.apiKey', '') },
    );

    const paymentUrl = (res?.payment_url || res?.redirect_url) as string | undefined;
    if (!paymentUrl) {
      throw new ServiceUnavailableException(
        'PipraPay checkout could not be started. Please try again or use another gateway.',
      );
    }
    return { paymentUrl, transactionRef };
  }

  /**
   * Server-to-server verification. Fails closed: any error, timeout or ambiguous
   * gateway response results in "not verified" and the membership is not granted.
   */
  private async verifyWithGateway(
    gateway: SubscriptionGateway,
    subscription: { id: string; paymentReference: string | null; amount: number },
    clientReference?: string,
  ): Promise<{ success: boolean; reference?: string; reason?: string }> {
    if (gateway === 'sandbox') {
      if (!this.isSandboxEnabled()) {
        return { success: false, reason: 'Sandbox confirmation is disabled' };
      }
      return {
        success: true,
        reference: clientReference || `SANDBOX_MEMBERSHIP_${subscription.id}`,
      };
    }

    if (gateway === 'aamarpay') {
      const requestId = clientReference || subscription.paymentReference;
      if (!requestId) {
        return { success: false, reason: 'Missing Aamarpay transaction reference' };
      }

      const verifyUrl = new URL(
        this.config.get<string>('payment.aamarpay.verifyUrl', ''),
      );
      verifyUrl.searchParams.set(
        'request_id',
        requestId,
      );
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
        const paid =
          body?.pay_status === 'Successful' || body?.status_code === '2';
        return paid
          ? { success: true, reference: String(body?.pg_txnid ?? requestId) }
          : { success: false, reason: 'Aamarpay reports the payment as unpaid' };
      } catch (err) {
        this.logger.error(`Aamarpay verification failed: ${String(err)}`);
        return { success: false, reason: 'Could not reach the payment gateway' };
      }
    }

    // PipraPay
    const transactionId = clientReference || subscription.paymentReference;
    if (!transactionId) {
      return { success: false, reason: 'Missing PipraPay transaction reference' };
    }

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
            transaction_id: transactionId,
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const body = (await response.json()) as Record<string, unknown>;
      const paid =
        body?.status === 'COMPLETED' ||
        body?.status === 'SUCCESS' ||
        body?.payment_status === 'completed';
      return paid
        ? { success: true, reference: String(body?.pp_txnid ?? transactionId) }
        : { success: false, reason: 'PipraPay reports the payment as unpaid' };
    } catch (err) {
      this.logger.error(`PipraPay verification failed: ${String(err)}`);
      return { success: false, reason: 'Could not reach the payment gateway' };
    }
  }

  private async postJson(
    url: string,
    payload: Record<string, unknown>,
    extraHeaders: Record<string, string> = {},
  ): Promise<Record<string, any> | null> {
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
        return JSON.parse(text) as Record<string, any>;
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
        paymentReference: `COMP_${userId}_${Date.now().toString(36)}`,
        startedAt,
        expiresAt,
      },
    });

    this.invalidateMembership(userId);
  }
}
