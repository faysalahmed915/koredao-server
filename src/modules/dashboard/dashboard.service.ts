import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import {
  UserRole,
  OrderStatus,
  EscrowStatus,
  VerificationStatus,
} from '@prisma/client';
import type {
  DashboardResponse,
  CustomerDashboardMetrics,
  MemberDashboardMetrics,
  VendorDashboardMetrics,
  AdminDashboardMetrics,
  MembershipSnapshot,
} from './dto/dashboard-metrics.dto.js';

import { ModerationService } from '../moderation/moderation.service.js';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly moderation: ModerationService,
  ) {}

  /**
   * Main entry point: aggregates role-specific dashboard metrics and actionable queues.
   *
   * The effective dashboard role is resolved as follows:
   * - Platform staff (ADMIN / SUPER_ADMIN / MODERATOR) -> command centre.
   * - VENDOR -> helper workspace (membership is reported alongside).
   * - CUSTOMER with an ACTIVE subscription -> MEMBER view.
   * - CUSTOMER otherwise -> student view.
   */
  async getMetrics(userId: string, role: UserRole | string): Promise<DashboardResponse> {
    const userRole = role as UserRole;
    const membership = await this.subscriptions.getMyMembership(userId);
    const snapshot = this.toSnapshot(membership);

    if (
      userRole === UserRole.ADMIN ||
      userRole === UserRole.SUPER_ADMIN ||
      userRole === UserRole.MODERATOR
    ) {
      return this.getAdminMetrics(userRole);
    }

    if (userRole === UserRole.VENDOR) {
      return this.getVendorMetrics(userId, snapshot);
    }

    const customerMetrics = await this.getCustomerMetrics(userId, snapshot);

    // A subscribed customer sees the MEMBER workspace rather than the plain
    // student dashboard, because they can now post and take jobs.
    if (membership.isMember) {
      return this.toMemberMetrics(customerMetrics, snapshot);
    }

    return customerMetrics;
  }

  private toSnapshot(membership: {
    isMember: boolean;
    plan: string | null;
    planName: string | null;
    status: string | null;
    startedAt: Date | null;
    expiresAt: Date | null;
    daysRemaining: number | null;
    autoRenew: boolean;
  }): MembershipSnapshot {
    return {
      isMember: membership.isMember,
      plan: membership.plan,
      planName: membership.planName,
      status: membership.status,
      startedAt: membership.startedAt,
      expiresAt: membership.expiresAt,
      daysRemaining: membership.daysRemaining,
      autoRenew: membership.autoRenew,
    };
  }

  private toMemberMetrics(
    customer: CustomerDashboardMetrics,
    membership: MembershipSnapshot,
  ): MemberDashboardMetrics {
    return {
      role: 'MEMBER',
      membership,
      perks: {
        canPostJobs: true,
        canTakeJobs: true,
        platformFeePercent: 8,
        feeDiscountPercent: 2,
      },
      stats: customer.stats,
      recentOrders: customer.recentOrders,
      allAssignments: customer.allAssignments,
      recommendedGigs: customer.recommendedGigs,
    };
  }

  /**
   * Aggregates Student / Customer metrics
   */
  private async getCustomerMetrics(
    userId: string,
    membership?: MembershipSnapshot,
  ): Promise<CustomerDashboardMetrics> {
    const [orders, assignments, conversations, recommendedGigs] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { customerId: userId },
          include: {
            vendorProfile: {
              include: {
                user: { select: { name: true, image: true } },
              },
            },
            escrowHolding: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.assignment.findMany({
          where: { customerId: userId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.conversation.findMany({
          where: { customerId: userId },
          include: {
            messages: {
              where: {
                senderId: { not: userId },
                isRead: false,
              },
              select: { id: true },
            },
          },
          // Bounded so a long-lived account cannot degrade its own dashboard.
          take: 50,
          orderBy: { lastMessageAt: 'desc' },
        }),
        this.prisma.gig.findMany({
          where: { isActive: true },
          include: {
            vendorProfile: {
              include: {
                user: { select: { name: true, image: true } },
              },
            },
          },
          orderBy: { rating: 'desc' },
          take: 4,
        }),
      ]);

    const activeStatuses: OrderStatus[] = [
      OrderStatus.IN_PROGRESS,
      OrderStatus.ESCROW_HELD,
      OrderStatus.PENDING_PAYMENT,
    ];
    const activeOrdersCount = orders.filter((o) => activeStatuses.includes(o.status)).length;

    const underReviewOrdersCount = orders.filter(
      (o) => o.status === OrderStatus.DELIVERED,
    ).length;

    const completedOrdersCount = orders.filter(
      (o) => o.status === OrderStatus.COMPLETED,
    ).length;

    const totalSpent = orders
      .filter((o) => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.ESCROW_HELD)
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const openAssignmentsCount = assignments.filter(
      (a) => a.status === 'OPEN',
    ).length;

    const totalBidsReceived = assignments.reduce(
      (sum, a) => sum + a.bidsCount,
      0,
    );

    const unreadMessagesCount = conversations.reduce(
      (sum, c) => sum + c.messages.length,
      0,
    );

    return {
      role: 'CUSTOMER',
      ...(membership ? { membership } : {}),
      stats: {
        activeOrdersCount,
        underReviewOrdersCount,
        completedOrdersCount,
        totalSpent,
        openAssignmentsCount,
        totalAssignmentsPosted: assignments.length,
        totalBidsReceived,
        unreadMessagesCount,
      },
      recentOrders: orders.slice(0, 5).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        title: o.title,
        totalAmount: o.totalAmount,
        status: o.status,
        deadline: o.deadline,
        vendorName: o.vendorProfile.user.name,
        vendorUniversity: o.vendorProfile.university,
        vendorImage: o.vendorProfile.user.image,
      })),
      allAssignments: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        subject: a.subject,
        budgetMin: a.budgetMin,
        budgetMax: a.budgetMax,
        bidsCount: a.bidsCount,
        status: a.status,
        createdAt: a.createdAt,
      })),
      recommendedGigs: recommendedGigs.map((g) => ({
        id: g.id,
        slug: g.slug,
        title: g.title,
        category: g.category,
        priceFrom: g.priceFrom,
        rating: g.rating,
        totalReviews: g.totalReviews,
        coverImage: g.coverImages?.[0],
        vendorName: g.vendorProfile.user.name,
        vendorUniversity: g.vendorProfile.university,
      })),
    };
  }

  /**
   * Aggregates Vendor / Academic Helper metrics
   */
  private async getVendorMetrics(
    userId: string,
    membership?: MembershipSnapshot,
  ): Promise<VendorDashboardMetrics> {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      include: {
        wallet: true,
      },
    });

    if (!vendorProfile) {
      return {
        role: 'VENDOR',
        isApproved: false,
        verificationStatus: VerificationStatus.PENDING,
        ...(membership ? { membership } : {}),
        stats: {
          availableBalance: 0,
          pendingEscrowBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          inProgressOrdersCount: 0,
          deliveredOrdersCount: 0,
          completedOrdersCount: 0,
          activeBidsCount: 0,
          acceptedBidsCount: 0,
          totalBidsApplied: 0,
          rating: 0,
          totalReviews: 0,
          unreadMessagesCount: 0,
        },
        urgentOrders: [],
        allBids: [],
        myGigs: [],
      };
    }

    const [orders, bids, gigs, conversations] = await Promise.all([
      this.prisma.order.findMany({
        where: { vendorProfileId: vendorProfile.id },
        include: {
          customer: {
            include: { customerProfile: true },
          },
          checkpoints: true,
        },
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.bid.findMany({
        where: { vendorProfileId: vendorProfile.id },
        include: {
          assignment: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.gig.findMany({
        where: { vendorProfileId: vendorProfile.id },
        orderBy: { orderCount: 'desc' },
      }),
      this.prisma.conversation.findMany({
        where: { vendorProfileId: vendorProfile.id },
        include: {
          messages: {
            where: {
              senderId: { not: userId },
              isRead: false,
            },
            select: { id: true },
          },
        },
        // Bounded for the same reason as the customer view.
        take: 50,
        orderBy: { lastMessageAt: 'desc' },
      }),
    ]);

    const inProgressStatuses: OrderStatus[] = [
      OrderStatus.IN_PROGRESS,
      OrderStatus.ESCROW_HELD,
    ];
    const inProgressOrdersCount = orders.filter((o) => inProgressStatuses.includes(o.status)).length;

    const deliveredOrdersCount = orders.filter(
      (o) => o.status === OrderStatus.DELIVERED,
    ).length;

    const completedOrdersCount = orders.filter(
      (o) => o.status === OrderStatus.COMPLETED,
    ).length;

    const activeBidsCount = bids.filter((b) => b.status === 'PENDING').length;
    const acceptedBidsCount = bids.filter((b) => b.status === 'ACCEPTED').length;

    const unreadMessagesCount = conversations.reduce(
      (sum, c) => sum + c.messages.length,
      0,
    );

    // Urgent active orders (deadline prioritized)
    const urgentStatuses: OrderStatus[] = [
      OrderStatus.IN_PROGRESS,
      OrderStatus.ESCROW_HELD,
      OrderStatus.DELIVERED,
    ];
    const urgentOrders = orders
      .filter((o) => urgentStatuses.includes(o.status))
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        title: o.title,
        totalAmount: o.totalAmount,
        status: o.status,
        deadline: o.deadline,
        customerName: o.customer.name,
        customerUniversity: o.customer.customerProfile?.university || null,
        checkpointsCount: o.checkpoints.length,
      }));

    return {
      role: 'VENDOR',
      isApproved: vendorProfile.verificationStatus === VerificationStatus.APPROVED,
      verificationStatus: vendorProfile.verificationStatus,
      ...(membership ? { membership } : {}),
      stats: {
        availableBalance: vendorProfile.wallet?.balance ?? 0,
        pendingEscrowBalance: vendorProfile.wallet?.pendingBalance ?? 0,
        totalEarned: vendorProfile.wallet?.totalEarned ?? 0,
        totalWithdrawn: vendorProfile.wallet?.totalWithdrawn ?? 0,
        inProgressOrdersCount,
        deliveredOrdersCount,
        completedOrdersCount,
        activeBidsCount,
        acceptedBidsCount,
        totalBidsApplied: bids.length,
        rating: vendorProfile.rating,
        totalReviews: vendorProfile.totalReviews,
        unreadMessagesCount,
      },
      urgentOrders,
      allBids: bids.map((b) => ({
        id: b.id,
        assignmentId: b.assignmentId,
        assignmentTitle: b.assignment.title,
        proposedPrice: b.proposedPrice,
        deliveryDays: b.deliveryDays,
        status: b.status,
        createdAt: b.createdAt,
      })),
      myGigs: gigs.map((g) => ({
        id: g.id,
        slug: g.slug,
        title: g.title,
        priceFrom: g.priceFrom,
        orderCount: g.orderCount,
        rating: g.rating,
        isActive: g.isActive,
      })),
    };
  }

  /**
   * Aggregates Super Admin / Moderator Command Center metrics
   */
  private async getAdminMetrics(adminRole: UserRole = UserRole.ADMIN): Promise<AdminDashboardMetrics> {
    const isModeratorOnly = adminRole === UserRole.MODERATOR;

    const [
      totalUsers,
      totalVendors,
      totalCustomers,
      totalGigs,
      totalAssignments,
      totalOrders,
      escrowHoldings,
      completedOrders,
      pendingVendors,
      disputedOrders,
      safetyAlertsCount,
      pendingHelpRequests,
      pendingAdminEscalations,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.vendorProfile.count({
        where: { verificationStatus: VerificationStatus.APPROVED },
      }),
      this.prisma.customerProfile.count(),
      this.prisma.gig.count({ where: { isActive: true } }),
      this.prisma.assignment.count(),
      this.prisma.order.count(),
      this.prisma.escrowHolding.findMany({
        where: { status: EscrowStatus.HELD },
        select: { amount: true },
      }),
      this.prisma.order.findMany({
        where: { status: OrderStatus.COMPLETED },
        select: { totalAmount: true, platformFee: true },
      }),
      this.prisma.vendorProfile.findMany({
        where: { verificationStatus: VerificationStatus.PENDING },
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.order.findMany({
        where: { status: OrderStatus.DISPUTED },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.chatMessage.count({
        where: { hasSafetyWarning: true },
      }),
      this.moderation.getPendingHelpRequests(),
      // Only ADMIN/SUPER_ADMIN can see moderator-to-admin escalations. Moderators cannot.
      isModeratorOnly
        ? Promise.resolve([])
        : this.moderation.getPendingAdminEscalations(),
    ]);

    const totalEscrowHeld = escrowHoldings.reduce((sum, e) => sum + e.amount, 0);
    const totalPlatformRevenue = completedOrders.reduce((sum, o) => sum + o.platformFee, 0);
    const totalGMV = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Moderators must NOT see payment/transaction data.
    const recentTransactions = isModeratorOnly
      ? []
      : await this.prisma.walletTransaction.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
        });

    return {
      role: adminRole as 'ADMIN' | 'SUPER_ADMIN' | 'MODERATOR',
      stats: {
        totalUsers,
        totalVendors,
        totalCustomers,
        totalGigs,
        totalAssignments,
        totalOrders,
        totalEscrowHeld,
        totalPlatformRevenue,
        totalGMV,
        pendingVerificationsCount: pendingVendors.length,
        disputedOrdersCount: disputedOrders.length,
        safetyAlertsCount,
        pendingHelpRequestsCount: pendingHelpRequests.length,
        pendingAdminEscalationsCount: pendingAdminEscalations.length,
      },
      pendingVerifications: pendingVendors.map((pv) => ({
        id: pv.id,
        userId: pv.userId,
        name: pv.user.name,
        email: pv.user.email,
        university: pv.university,
        department: pv.department,
        idCardUrl: pv.idCardUrl,
        createdAt: pv.createdAt,
      })),
      moderationHelpRequests: pendingHelpRequests.map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber,
        orderTitle: r.orderTitle,
        orderStatus: r.orderStatus,
        requestedById: r.requestedById,
        requestedByName: r.requestedByName,
        requestedByRole: r.requestedByRole,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
      moderatorAdminEscalations: pendingAdminEscalations.map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber,
        orderTitle: r.orderTitle,
        requestedById: r.requestedById,
        requestedByName: r.requestedByName,
        requestedByRole: r.requestedByRole,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
      recentTransactions: recentTransactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        payoutMethod: tx.payoutMethod,
        createdAt: tx.createdAt,
      })),
      disputedOrders: disputedOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        title: o.title,
        totalAmount: o.totalAmount,
        disputeReason: o.disputeReason,
        createdAt: o.createdAt,
      })),
    };
  }
}
