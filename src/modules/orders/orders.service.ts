import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { SubmitDeliveryDto } from './dto/submit-delivery.dto.js';
import { RequestRevisionDto } from './dto/request-revision.dto.js';
import { RaiseDisputeDto } from './dto/raise-dispute.dto.js';
import { ResolveDisputeDto, DisputeDecision } from './dto/resolve-dispute.dto.js';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto.js';
import {
  AssignmentStatus,
  EscrowStatus,
  NotificationType,
  OrderStatus,
  WalletTransactionType,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service.js';

export const ORDER_DETAIL_INCLUDE = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
  vendorProfile: {
    select: {
      id: true,
      userId: true,
      university: true,
      department: true,
      academicLevel: true,
      rating: true,
      totalReviews: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  },
  escrowHolding: true,
  gig: {
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
    },
  },
  assignment: {
    select: {
      id: true,
      title: true,
      subject: true,
      type: true,
    },
  },
} as const;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Initializes a new order from a Gig purchase or accepted Assignment bid.
   */
  async create(customerId: string, dto: CreateOrderDto) {
    if (dto.gigId) {
      return this.createOrderFromGig(customerId, dto.gigId, dto.packageIndex ?? 0);
    }

    if (dto.assignmentId && dto.bidId) {
      return this.createOrderFromBid(customerId, dto.assignmentId, dto.bidId);
    }

    throw new ConflictException('Either gigId or (assignmentId and bidId) must be provided to create an order');
  }

  /**
   * Creates an order from a Gig package.
   */
  private async createOrderFromGig(customerId: string, gigId: string, packageIndex: number) {
    const gig = await this.prisma.gig.findUnique({
      where: { id: gigId },
      include: { vendorProfile: true },
    });

    if (!gig || !gig.isActive) {
      throw new NotFoundException('Service gig not found or currently inactive');
    }

    if (gig.vendorProfile.userId === customerId) {
      throw new ConflictException('You cannot purchase your own service gig');
    }

    const packages = gig.packages as Array<{
      name: string;
      price: number;
      deliveryDays: number;
      revisions?: number;
      description?: string;
    }>;

    const selectedPkg = packages[packageIndex] || packages[0];
    if (!selectedPkg) {
      throw new NotFoundException('Selected package does not exist');
    }

    const totalAmount = selectedPkg.price;
    const platformFee = Math.round(totalAmount * 0.10); // Standard 10% Platform Fee
    const netVendorAmount = totalAmount - platformFee;

    const deadline = new Date(Date.now() + selectedPkg.deliveryDays * 24 * 60 * 60 * 1000);
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          vendorProfileId: gig.vendorProfileId,
          gigId: gig.id,
          packageName: selectedPkg.name,
          title: gig.title,
          totalAmount,
          platformFee,
          netVendorAmount,
          status: OrderStatus.PENDING_PAYMENT,
          deadline,
          maxRevisions: selectedPkg.revisions ?? 1,
        },
      });

      await tx.escrowHolding.create({
        data: {
          orderId: created.id,
          amount: totalAmount,
          status: EscrowStatus.AWAITING_PAYMENT,
        },
      });

      return created;
    });

    this.logger.log(`Order created from Gig: orderId=${order.id}, totalAmount=${totalAmount} BDT`);
    // Notify the helper that work is waiting (payment not required yet).
    await this.notifications.safeNotify(gig.vendorProfile.userId, {
      type: NotificationType.ORDER,
      title: 'New order received',
      body: `A customer ordered "${selectedPkg.name}" for ${gig.title} — ৳${totalAmount}.`,
      link: `/orders/${order.id}`,
    });
    return this.findById(order.id, customerId);
  }

  /**
   * Creates an order from an accepted Assignment Bid.
   */
  private async createOrderFromBid(customerId: string, assignmentId: string, bidId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment request not found');
    }

    if (assignment.customerId !== customerId) {
      throw new ForbiddenException('You do not own this assignment request');
    }

    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: { vendorProfile: true },
    });

    if (!bid || bid.assignmentId !== assignmentId) {
      throw new NotFoundException('Bid not found for this assignment');
    }

    // Idempotency guard: if an order already exists for this assignment+bid,
    // return it instead of creating a duplicate.
    const existingOrder = await this.prisma.order.findFirst({
      where: { assignmentId, bidId },
      select: { id: true, orderNumber: true, status: true, escrowHolding: true },
    });

    if (existingOrder) {
      this.logger.log(
        `Idempotent createOrderFromBid: order ${existingOrder.id} already exists for assignmentId=${assignmentId} bidId=${bidId}. Returning existing order.`,
      );
      return this.findById(existingOrder.id, customerId);
    }

    const totalAmount = bid.proposedPrice;
    const platformFee = Math.round(totalAmount * 0.10); // 10% fee
    const netVendorAmount = totalAmount - platformFee;

    const deadline = new Date(Date.now() + bid.deliveryDays * 24 * 60 * 60 * 1000);
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          vendorProfileId: bid.vendorProfileId,
          assignmentId: assignment.id,
          bidId: bid.id,
          title: assignment.title,
          totalAmount,
          platformFee,
          netVendorAmount,
          status: OrderStatus.PENDING_PAYMENT,
          customerAcceptedAt: new Date(),
          deadline,
          maxRevisions: 2, // Standard 2 revisions for assignments
        },
      });

      await tx.escrowHolding.create({
        data: {
          orderId: created.id,
          amount: totalAmount,
          status: EscrowStatus.AWAITING_PAYMENT,
        },
      });

      // Mark assignment as ASSIGNED
      await tx.assignment.update({
        where: { id: assignmentId },
        data: { status: AssignmentStatus.ASSIGNED, acceptedBidId: bidId },
      });

      return created;
    });

    this.logger.log(`Order created from Bid: orderId=${order.id}, totalAmount=${totalAmount} BDT`);
    await this.notifications.safeNotify(bid.vendorProfile.userId, {
      type: NotificationType.ORDER,
      title: 'Your proposal was accepted',
      body: `An order for "${assignment.title}" was created from your proposal — ৳${totalAmount}.`,
      link: `/orders/${order.id}`,
    });
    return this.findById(order.id, customerId);
  }

  /**
   * Vendor accepts a gig-order that a customer opened (the "customer clicks a gig,
   * vendor accepts the job" handshake). This does NOT activate the job — it only
   * records mutual agreement so both parties can set targets / materials in the
   * target sidebar before payment.
   */
  async vendorAcceptOrder(vendorUserId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vendorProfile: true },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (order.vendorProfile.userId !== vendorUserId) {
      throw new ForbiddenException('Only the assigned helper can accept this order');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException(
        `Order cannot be accepted because it is already '${order.status}'`,
      );
    }

    if (order.vendorAcceptedAt) {
      throw new ConflictException('You have already accepted this order');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { vendorAcceptedAt: new Date() },
    });

    this.logger.log(`Vendor accepted orderId=${orderId} (orderNumber=${order.orderNumber})`);
    await this.notifications.safeNotify(order.customerId, {
      type: NotificationType.ORDER,
      title: 'Helper accepted your order',
      body: `${order.orderNumber} has been accepted. Fund escrow to start the work.`,
      link: `/orders/${order.id}`,
    });
    return this.findById(updated.id, vendorUserId);
  }

  /**
   * Confirms payment and locks funds in Escrow.
   * Helper is notified and authorized to begin work.
   *
   * `actorUserId` is the authenticated caller initiating the escrow funding. When
   * provided, the caller must be the order's customer or an admin/moderator; this
   * prevents any signed-in user from arbitrarily funding another user's order.
   * Payment gateway IPN callbacks pass no actor (system-level trust).
   */
  async fundEscrow(
    orderId: string,
    gateway: string = 'MOCK_SANDBOX',
    transactionRef?: string,
    actorUserId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowHolding: true, vendorProfile: { select: { userId: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    // Security: when an authenticated actor initiates funding (manual/sandbox path),
    // they must be the order's customer. System callers (payment IPN) pass no actor.
    if (actorUserId && order.customerId !== actorUserId) {
      throw new ForbiddenException('You do not have permission to fund this order');
    }

    if (order.status === OrderStatus.ESCROW_HELD) {
      // Idempotent: escrow already funded (e.g. duplicate IPN callback / retry).
      // Return current state instead of erroring or double-funding.
      this.logger.log(
        `Idempotent fundEscrow: orderId=${orderId} already ESCROW_HELD. Returning existing state.`,
      );
      return this.findById(orderId, order.customerId);
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException(`Order is already in '${order.status}' status`);
    }

    const txnRef = transactionRef || `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.ESCROW_HELD },
      }),
      this.prisma.escrowHolding.update({
        where: { orderId },
        data: {
          status: EscrowStatus.HELD,
          paymentGateway: gateway,
          transactionRef: txnRef,
          fundedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(`Escrow funded for orderId=${orderId}, amount=${order.totalAmount} BDT via ${gateway}`);
    // Money moment: both parties get a durable record of the escrow lock.
    await Promise.all([
      this.notifications.safeNotify(order.vendorProfile.userId, {
        type: NotificationType.ESCROW,
        title: 'Escrow funded — you can start work',
        body: `Payment confirmed for ${order.orderNumber} (৳${order.totalAmount}).`,
        link: `/orders/${order.id}`,
      }),
      this.notifications.safeNotify(order.customerId, {
        type: NotificationType.ESCROW,
        title: 'Payment locked in escrow',
        body: `৳${order.totalAmount} for ${order.orderNumber} is held safely until you approve the delivery.`,
        link: `/orders/${order.id}`,
      }),
    ]);
    return this.findById(orderId, order.customerId);
  }

  /**
   * Helper submits completed deliverables.
   * Enforces Rule: Delivery cannot be submitted without confirmed Escrow funding!
   * Starts the 72-hour countdown timer.
   */
  async submitDelivery(vendorUserId: string, orderId: string, dto: SubmitDeliveryDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vendorProfile: true, escrowHolding: true },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (order.vendorProfile.userId !== vendorUserId) {
      throw new ForbiddenException('You are not the designated helper for this order');
    }

    // Critical Security Check: Escrow must be funded
    if (order.status !== OrderStatus.ESCROW_HELD && order.status !== OrderStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Cannot submit delivery. Order must have confirmed escrow funding (current status: ${order.status})`,
      );
    }

    const now = new Date();
    const autoReleaseAt = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 Hours from now

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: now,
        autoReleaseAt,
        deliveryFiles: dto.deliveryFiles,
        deliveryNotes: dto.deliveryNotes,
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    this.logger.log(
      `Deliverable submitted for orderId=${orderId}. 72-hour auto-release timer set to ${autoReleaseAt.toISOString()}`,
    );
    await this.notifications.safeNotify(order.customerId, {
      type: NotificationType.ORDER,
      title: 'Delivery submitted',
      body: `Your order ${order.orderNumber} is ready for review. Auto-release in 72 hours.`,
      link: `/orders/${order.id}`,
    });

    return updated;
  }

  /**
   * Customer accepts delivered work and releases Escrow funds to Helper Wallet.
   */
  async acceptDelivery(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowHolding: true, vendorProfile: true },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You do not have permission to accept this order');
    }

    // Idempotency: if already completed or escrow already released, return
    // existing state without mutating (safe against client retries and cron races).
    if (
      order.status === OrderStatus.COMPLETED ||
      order.escrowHolding?.status === EscrowStatus.RELEASED_TO_VENDOR
    ) {
      this.logger.log(
        `Idempotent acceptDelivery: orderId=${orderId} already ${order.status}. Returning existing state.`,
      );
      return this.findById(orderId, customerId);
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new ConflictException(`Order cannot be completed because it is in '${order.status}' status`);
    }

    return this.completeOrderAndReleaseFunds(order.id);
  }

  /**
   * Internal reusable completion logic (used by customer approval and 72-hour cron job).
   */
  private async completeOrderAndReleaseFunds(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowHolding: true, vendorProfile: true },
    });

    if (!order) return;

    // Idempotency guard: if the order is already completed or the escrow is
    // already released, skip all mutation. Prevents double wallet crediting
    // when acceptDelivery and the 72-hour cron race each other or retry.
    if (
      order.status === OrderStatus.COMPLETED ||
      order.escrowHolding?.status === EscrowStatus.RELEASED_TO_VENDOR
    ) {
      this.logger.log(
        `Idempotent completeOrderAndReleaseFunds: orderId=${orderId} already ${order.status} (escrow ${order.escrowHolding?.status}). Skipping wallet credit.`,
      );
      return this.findById(orderId, order.customerId);
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Mark order completed
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: now,
          autoReleaseAt: null,
        },
      });

      // 2. Mark escrow released
      await tx.escrowHolding.update({
        where: { orderId },
        data: {
          status: EscrowStatus.RELEASED_TO_VENDOR,
          releasedAt: now,
        },
      });

      // 3. Upsert Vendor Wallet and credit net payout (90%)
      const wallet = await tx.vendorWallet.upsert({
        where: { vendorProfileId: order.vendorProfileId },
        create: {
          vendorProfileId: order.vendorProfileId,
          balance: order.netVendorAmount,
          totalEarned: order.netVendorAmount,
        },
        update: {
          balance: { increment: order.netVendorAmount },
          totalEarned: { increment: order.netVendorAmount },
        },
      });

      // 4. Log wallet transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          orderId: order.id,
          amount: order.netVendorAmount,
          type: WalletTransactionType.ESCROW_RELEASE,
          description: `Escrow payout released for Order #${order.orderNumber} (10% platform fee retained)`,
        },
      });

      // 5. Increment completed order counts
      await tx.vendorProfile.update({
        where: { id: order.vendorProfileId },
        data: { completedOrders: { increment: 1 } },
      });

      if (order.gigId) {
        await tx.gig.update({
          where: { id: order.gigId },
          data: { orderCount: { increment: 1 } },
        });
      }
    });

    this.logger.log(`Order #${order.orderNumber} completed. Credited ৳${order.netVendorAmount} to helper wallet.`);
    await Promise.all([
      this.notifications.safeNotify(order.vendorProfile.userId, {
        type: NotificationType.ESCROW,
        title: 'Payout released',
        body: `৳${order.netVendorAmount} was credited to your wallet for ${order.orderNumber}.`,
        link: '/vendor/wallet',
      }),
      this.notifications.safeNotify(order.customerId, {
        type: NotificationType.ORDER,
        title: 'Order completed',
        body: `Delivery for ${order.orderNumber} was approved and escrow released.`,
        link: `/orders/${order.id}`,
      }),
    ]);
    return this.findById(orderId, order.customerId);
  }

  /**
   * Customer requests a revision within the permitted revision limit.
   */
  async requestRevision(customerId: string, orderId: string, dto: RequestRevisionDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vendorProfile: { select: { userId: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You do not own this order');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new ConflictException(`Revisions can only be requested while the order is in DELIVERED status`);
    }

    if (order.usedRevisions >= order.maxRevisions) {
      throw new ConflictException(
        `Maximum revision limit (${order.maxRevisions}) reached. If you remain unsatisfied, please raise a dispute.`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.IN_PROGRESS,
        usedRevisions: { increment: 1 },
        revisionNotes: dto.revisionNotes,
        autoReleaseAt: null, // Pause auto-release countdown
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    this.logger.log(`Revision requested for orderId=${orderId} (round ${updated.usedRevisions}/${updated.maxRevisions})`);
    await this.notifications.safeNotify(order.vendorProfile.userId, {
      type: NotificationType.ORDER,
      title: 'Revision requested',
      body: `The customer requested revision ${updated.usedRevisions}/${updated.maxRevisions} for ${order.orderNumber}.`,
      link: `/orders/${order.id}`,
    });
    return updated;
  }

  /**
   * Raises a dispute on an order, pausing all automated timers for moderator arbitration.
   */
  async raiseDispute(userId: string, orderId: string, dto: RaiseDisputeDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vendorProfile: true },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    const isCustomer = order.customerId === userId;
    const isVendor = order.vendorProfile.userId === userId;

    if (!isCustomer && !isVendor) {
      throw new ForbiddenException('You are not a participant in this order');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.DISPUTED,
        disputeReason: dto.disputeReason,
        autoReleaseAt: null,
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    this.logger.log(`Dispute raised on orderId=${orderId} by userId=${userId}: ${dto.disputeReason}`);
    // Tell the OTHER party — the actor already knows they raised it.
    const counterpartId = isCustomer ? order.vendorProfile.userId : order.customerId;
    await this.notifications.safeNotify(counterpartId, {
      type: NotificationType.ORDER,
      title: 'Dispute opened on your order',
      body: `${order.orderNumber} was moved to dispute. Our moderators will review it shortly.`,
      link: `/orders/${order.id}`,
    });
    return updated;
  }

  /**
   * Admin resolution for an order dispute.
   */
  async resolveDispute(adminId: string, orderId: string, dto: ResolveDisputeDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowHolding: true, vendorProfile: true },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (order.status !== OrderStatus.DISPUTED) {
      throw new ConflictException(`Order is not in DISPUTED status`);
    }

    if (dto.decision === DisputeDecision.RELEASE_TO_VENDOR) {
      return this.completeOrderAndReleaseFunds(order.id);
    }

    // Refund to customer
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.REFUNDED,
          disputeResolvedAt: now,
          revisionNotes: dto.resolutionNotes,
        },
      }),
      this.prisma.escrowHolding.update({
        where: { orderId },
        data: {
          status: EscrowStatus.REFUNDED_TO_CUSTOMER,
          refundedAt: now,
        },
      }),
    ]);

    this.logger.log(`Dispute for orderId=${orderId} resolved with full refund to customer.`);
    await Promise.all([
      this.notifications.safeNotify(order.customerId, {
        type: NotificationType.ESCROW,
        title: 'Dispute resolved — you were refunded',
        body: `Escrow for ${order.orderNumber} was refunded to you.${dto.resolutionNotes ? ` Note: ${dto.resolutionNotes}` : ''}`,
        link: `/orders/${order.id}`,
      }),
      this.notifications.safeNotify(order.vendorProfile.userId, {
        type: NotificationType.ORDER,
        title: 'Dispute resolved',
        body: `The dispute on ${order.orderNumber} was resolved in the customer's favour and escrow was refunded.`,
        link: `/orders/${order.id}`,
      }),
    ]);
    return this.findById(orderId, order.customerId);
  }

  /**
   * Scheduled 72-hour auto-release worker.
   * Runs every hour to release escrow funds for delivered orders whose review
   * window has elapsed. Idempotent: safe to run concurrently or retry.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handle72HourAutoReleaseCron(): Promise<void> {
    this.logger.log('Running scheduled 72-hour auto-release worker...');
    const result = await this.process72HourAutoReleases();
    this.logger.log(
      `Scheduled 72-hour auto-release processed ${result.processedCount} orders.`,
    );
  }

  /**
   * Automated 72-Hour Auto-Release Worker.
   * Finds delivered orders where the 72-hour review window has elapsed and releases funds.
   */
  async process72HourAutoReleases(): Promise<{ processedCount: number }> {
    const now = new Date();
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        autoReleaseAt: { lte: now },
      },
      select: { id: true, orderNumber: true },
    });

    if (expiredOrders.length === 0) {
      return { processedCount: 0 };
    }

    this.logger.log(`Processing 72-hour auto-release for ${expiredOrders.length} delivered orders...`);

    let processed = 0;
    for (const order of expiredOrders) {
      try {
        await this.completeOrderAndReleaseFunds(order.id);
        processed++;
      } catch (err: any) {
        this.logger.error(`Failed to auto-release order ${order.orderNumber}: ${err.message}`);
      }
    }

    return { processedCount: processed };
  }

  /**
   * Retrieves single order by ID with ownership guard.
   */
  async findById(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    const isCustomer = order.customerId === userId;
    const isVendor = order.vendorProfile.userId === userId;

    if (!isCustomer && !isVendor) {
      throw new ForbiddenException('You do not have access to view this order');
    }

    return order;
  }

  /**
   * Retrieves all orders for the caller (as customer or helper).
   */
  async getMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: {
        OR: [
          { customerId: userId },
          { vendorProfile: { userId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        gig: { select: { id: true, title: true, slug: true } },
        assignment: { select: { id: true, title: true } },
        escrowHolding: { select: { status: true, amount: true } },
        vendorProfile: {
          select: {
            user: { select: { name: true, image: true } },
          },
        },
      },
    });
  }

  /**
   * Retrieves current vendor wallet balance and transaction ledger.
   */
  async getVendorWallet(vendorUserId: string) {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId: vendorUserId },
      include: {
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
      },
    });

    if (!vendorProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    return vendorProfile.wallet ?? {
      balance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      transactions: [],
    };
  }

  /**
   * Helper requests a withdrawal from their available wallet balance.
   */
  async requestWithdrawal(vendorUserId: string, dto: RequestWithdrawalDto) {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId: vendorUserId },
      include: { wallet: true },
    });

    if (!vendorProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    const wallet = vendorProfile.wallet;
    if (!wallet || wallet.balance < dto.amount) {
      throw new ConflictException(`Insufficient wallet balance. Available: ৳${wallet?.balance ?? 0}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.vendorWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: dto.amount },
          totalWithdrawn: { increment: dto.amount },
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: -dto.amount,
          type: WalletTransactionType.WITHDRAWAL,
          description: `Withdrawal via ${dto.payoutMethod} to ${dto.payoutAccount}`,
          payoutMethod: dto.payoutMethod,
          payoutAccount: dto.payoutAccount,
        },
      });

      this.logger.log(
        `Withdrawal requested by vendorProfileId=${vendorProfile.id}: ৳${dto.amount} via ${dto.payoutMethod} to ${dto.payoutAccount}`,
      );

      return {
        wallet: updatedWallet,
        transaction,
      };
    });

    // Receipt for the helper's own records (fires after the tx commits).
    await this.notifications.safeNotify(vendorUserId, {
      type: NotificationType.PAYOUT,
      title: 'Withdrawal requested',
      body: `৳${dto.amount} via ${dto.payoutMethod} to ${dto.payoutAccount} was deducted from your wallet.`,
      link: '/vendor/wallet',
    });

    return result;
  }
}
