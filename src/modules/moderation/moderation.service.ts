import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import {
  ModerationRequest,
  ModeratorAdminRequest,
  UserRole,
  ModerationRequestStatus,
  ModeratorAdminRequestStatus,
  OrderStatus,
} from '@prisma/client';
import {
  RequestModeratorHelpDto,
  ResolveModerationRequestDto,
  RequestAdminEscalationDto,
  ResolveModeratorAdminRequestDto,
} from './dto/moderation.dto.js';

export interface HelpRequestItem {
  id: string;
  orderId: string;
  orderNumber: string;
  orderTitle: string;
  orderStatus: string;
  requestedById: string;
  requestedByName: string;
  requestedByRole: string;
  reason: string;
  status: ModerationRequestStatus;
  moderatorId: string | null;
  moderatorName: string | null;
  moderatorNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface AdminEscalationItem {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  orderTitle: string | null;
  requestedById: string;
  requestedByName: string;
  requestedByRole: string;
  reason: string;
  status: ModeratorAdminRequestStatus;
  adminId: string | null;
  adminName: string | null;
  adminNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.ESCROW_HELD,
  OrderStatus.IN_PROGRESS,
  OrderStatus.DELIVERED,
];

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Customer or vendor requests moderator help on an active job.
   * Only one pending request per order is allowed.
   */
  async requestHelp(
    userId: string,
    dto: RequestModeratorHelpDto,
  ): Promise<ModerationRequest> {
    // Verify the order exists and is active
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { customer: true, vendorProfile: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Only the customer or vendor on the order can request help
    if (
      order.customerId !== userId &&
      order.vendorProfileId !== userId
    ) {
      throw new ForbiddenException(
        'You can only request help on orders you are a party to',
      );
    }

    // Only active jobs can request moderator help
    if (!ACTIVE_ORDER_STATUSES.includes(order.status as OrderStatus)) {
      throw new ForbiddenException(
        'Moderator help can only be requested on active jobs',
      );
    }

    // Prevent duplicate pending requests for the same order
    const existing = await this.prisma.moderationRequest.findFirst({
      where: {
        orderId: dto.orderId,
        status: ModerationRequestStatus.PENDING,
      },
    });

    if (existing) {
      throw new ForbiddenException(
        'A pending moderator help request already exists for this order',
      );
    }

    return this.prisma.moderationRequest.create({
      data: {
        orderId: dto.orderId,
        requestedById: userId,
        reason: dto.reason,
        status: ModerationRequestStatus.PENDING,
      },
      include: {
        order: { select: { orderNumber: true, title: true, status: true } },
        requestedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  /**
   * Get all pending moderation help requests (moderator+ only).
   */
  async getPendingHelpRequests(): Promise<HelpRequestItem[]> {
    const rows = await this.prisma.moderationRequest.findMany({
      where: { status: ModerationRequestStatus.PENDING },
      include: {
        order: { select: { orderNumber: true, title: true, status: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        moderator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      orderTitle: r.order.title,
      orderStatus: r.order.status,
      requestedById: r.requestedBy.id,
      requestedByName: r.requestedBy.name,
      requestedByRole: r.requestedBy.role,
      reason: r.reason,
      status: r.status,
      moderatorId: r.moderatorId,
      moderatorName: r.moderator?.name ?? null,
      moderatorNote: r.moderatorNote,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Get all moderation requests with optional status filter (moderator+ only).
   */
  async getAllHelpRequests(
    status?: ModerationRequestStatus,
  ): Promise<HelpRequestItem[]> {
    const rows = await this.prisma.moderationRequest.findMany({
      where: status ? { status } : {},
      include: {
        order: { select: { orderNumber: true, title: true, status: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        moderator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      orderTitle: r.order.title,
      orderStatus: r.order.status,
      requestedById: r.requestedBy.id,
      requestedByName: r.requestedBy.name,
      requestedByRole: r.requestedBy.role,
      reason: r.reason,
      status: r.status,
      moderatorId: r.moderatorId,
      moderatorName: r.moderator?.name ?? null,
      moderatorNote: r.moderatorNote,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Resolve a moderation request (moderator+ only).
   * Records which moderator provided the help.
   */
  async resolveRequest(
    moderatorId: string,
    dto: ResolveModerationRequestDto,
  ): Promise<HelpRequestItem> {
    const request = await this.prisma.moderationRequest.findUnique({
      where: { id: dto.requestId },
    });

    if (!request) {
      throw new NotFoundException('Moderation request not found');
    }

    const updated = await this.prisma.moderationRequest.update({
      where: { id: dto.requestId },
      data: {
        status: dto.status,
        moderatorId,
        moderatorNote: dto.moderatorNote,
        resolvedAt: new Date(),
      },
      include: {
        order: { select: { orderNumber: true, title: true, status: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        moderator: { select: { id: true, name: true } },
      },
    });

    return {
      id: updated.id,
      orderId: updated.orderId,
      orderNumber: updated.order.orderNumber,
      orderTitle: updated.order.title,
      orderStatus: updated.order.status,
      requestedById: updated.requestedBy.id,
      requestedByName: updated.requestedBy.name,
      requestedByRole: updated.requestedBy.role,
      reason: updated.reason,
      status: updated.status,
      moderatorId: updated.moderatorId,
      moderatorName: updated.moderator?.name ?? null,
      moderatorNote: updated.moderatorNote,
      resolvedAt: updated.resolvedAt,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Moderator escalates a transaction issue to admin.
   * Moderators cannot access payment data directly - they request admin review.
   */
  async requestAdminEscalation(
    userId: string,
    dto: RequestAdminEscalationDto,
  ): Promise<AdminEscalationItem> {
    // If orderId is provided, verify it exists
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
    }

    const created = await this.prisma.moderatorAdminRequest.create({
      data: {
        orderId: dto.orderId ?? null,
        requestedById: userId,
        reason: dto.reason,
        status: 'PENDING',
      },
      include: {
        order: { select: { orderNumber: true, title: true, status: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        admin: { select: { id: true, name: true } },
      },
    });

    return {
      id: created.id,
      orderId: created.orderId,
      orderNumber: created.order?.orderNumber ?? null,
      orderTitle: created.order?.title ?? null,
      requestedById: created.requestedBy.id,
      requestedByName: created.requestedBy.name,
      requestedByRole: created.requestedBy.role,
      reason: created.reason,
      status: created.status,
      adminId: created.adminId,
      adminName: created.admin?.name ?? null,
      adminNote: created.adminNote,
      resolvedAt: created.resolvedAt,
      createdAt: created.createdAt,
    };
  }

  /**
   * Get all pending moderator-to-admin escalation requests (admin only).
   */
  async getPendingAdminEscalations(): Promise<AdminEscalationItem[]> {
    const rows = await this.prisma.moderatorAdminRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        order: { select: { orderNumber: true, title: true, status: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        admin: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? null,
      orderTitle: r.order?.title ?? null,
      requestedById: r.requestedBy.id,
      requestedByName: r.requestedBy.name,
      requestedByRole: r.requestedBy.role,
      reason: r.reason,
      status: r.status,
      adminId: r.adminId,
      adminName: r.admin?.name ?? null,
      adminNote: r.adminNote,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Get all moderator-to-admin escalation requests with optional status filter (admin only).
   */
  async getAllAdminEscalations(status?: 'PENDING' | 'RESOLVED' | 'DISMISSED'): Promise<AdminEscalationItem[]> {
    const rows = await this.prisma.moderatorAdminRequest.findMany({
      where: status ? { status } : {},
      include: {
        order: { select: { orderNumber: true, title: true, status: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        admin: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? null,
      orderTitle: r.order?.title ?? null,
      requestedById: r.requestedBy.id,
      requestedByName: r.requestedBy.name,
      requestedByRole: r.requestedBy.role,
      reason: r.reason,
      status: r.status,
      adminId: r.adminId,
      adminName: r.admin?.name ?? null,
      adminNote: r.adminNote,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Resolve a moderator-to-admin escalation request (admin only).
   * Records which admin addressed the request.
   */
  async resolveAdminEscalation(
    adminId: string,
    dto: ResolveModeratorAdminRequestDto,
  ): Promise<AdminEscalationItem> {
    const request = await this.prisma.moderatorAdminRequest.findUnique({
      where: { id: dto.requestId },
    });

    if (!request) {
      throw new NotFoundException('Moderator admin request not found');
    }

    const updated = await this.prisma.moderatorAdminRequest.update({
      where: { id: dto.requestId },
      data: {
        status: dto.status,
        adminId,
        adminNote: dto.adminNote,
        resolvedAt: new Date(),
      },
      include: {
        order: { select: { orderNumber: true, title: true, status: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        admin: { select: { id: true, name: true } },
      },
    });

    return {
      id: updated.id,
      orderId: updated.orderId,
      orderNumber: updated.order?.orderNumber ?? null,
      orderTitle: updated.order?.title ?? null,
      requestedById: updated.requestedBy.id,
      requestedByName: updated.requestedBy.name,
      requestedByRole: updated.requestedBy.role,
      reason: updated.reason,
      status: updated.status,
      adminId: updated.adminId,
      adminName: updated.admin?.name ?? null,
      adminNote: updated.adminNote,
      resolvedAt: updated.resolvedAt,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Get moderation request history for a specific order.
   */
  async getOrderModerationHistory(orderId: string): Promise<{
    helpRequests: HelpRequestItem[];
    escalations: AdminEscalationItem[];
  }> {
    const [helpRequests, escalations] = await Promise.all([
      this.prisma.moderationRequest.findMany({
        where: { orderId },
        include: {
          requestedBy: { select: { id: true, name: true, role: true } },
          moderator: { select: { id: true, name: true } },
          order: { select: { orderNumber: true, title: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.moderatorAdminRequest.findMany({
        where: { orderId },
        include: {
          requestedBy: { select: { id: true, name: true, role: true } },
          admin: { select: { id: true, name: true } },
          order: { select: { orderNumber: true, title: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      helpRequests: helpRequests.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        orderNumber: r.order.orderNumber,
        orderTitle: r.order.title,
        orderStatus: r.order.status,
        requestedById: r.requestedBy.id,
        requestedByName: r.requestedBy.name,
        requestedByRole: r.requestedBy.role,
        reason: r.reason,
        status: r.status,
        moderatorId: r.moderatorId,
        moderatorName: r.moderator?.name ?? null,
        moderatorNote: r.moderatorNote,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
      })),
      escalations: escalations.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        orderNumber: r.order?.orderNumber ?? null,
        orderTitle: r.order?.title ?? null,
        requestedById: r.requestedBy.id,
        requestedByName: r.requestedBy.name,
        requestedByRole: r.requestedBy.role,
        reason: r.reason,
        status: r.status,
        adminId: r.adminId,
        adminName: r.admin?.name ?? null,
        adminNote: r.adminNote,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
      })),
    };
  }
}
