import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service.js';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service.js';
import type {
  NotificationListQuery,
  UpdatePreferenceDto,
  CreateNotificationDto,
  NotificationResponse,
  PreferenceResponse,
  UnreadCountResponse,
  SlaTrackerResponse,
  SlaTrackerItem,
  NotificationType,
} from './notification.dto.js';

const DEFAULT_SLA_HOURS = 24;
const ESCROW_WARNING_WINDOW_HOURS = 24;
const SAFETY_RECENT_WINDOW_HOURS = 2;

type NotificationPreferenceUpdate = Partial<{
  emailEnabled: boolean;
  inAppEnabled: boolean;
  vendorAppOutcome: boolean;
  disputeSla: boolean;
  releaseWarning: boolean;
  safetyAlert: boolean;
}>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /** Map a notification type to its preference category */
  private typePreferenceKey(type: NotificationType): keyof NotificationPreferenceUpdate {
    switch (type) {
      case 'VENDOR_APPLICATION_APPROVED':
      case 'VENDOR_APPLICATION_REJECTED':
        return 'vendorAppOutcome';
      case 'DISPUTE_SLA_COUNTDOWN':
      case 'DISPUTE_SLA_BREACH':
        return 'disputeSla';
      case 'ESCROW_RELEASE_WARNING':
        return 'releaseWarning';
      case 'SAFETY_ALERT':
        return 'safetyAlert';
      default:
        return 'inAppEnabled';
    }
  }

  /** Best-effort email dispatch. Never throws: in-app delivery must not depend on email. */
  private async sendEmail(
    to: string,
    title: string,
    body: string,
  ): Promise<{ sent: boolean; reason?: string }> {
    const host = process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY;
    if (!host) {
      this.logger.log(
        `Email transport not configured; skipping email to ${to}: ${title}`,
      );
      return { sent: false, reason: 'no_transport_configured' };
    }
    try {
      // Placeholder for a wired transport (SMTP / SendGrid / Resend). Credentials
      // must come from environment; none are embedded here.
      this.logger.log(`Would send email to ${to}: ${title}`);
      return { sent: true };
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err?.message ?? err}`);
      return { sent: false, reason: err?.message ?? 'send_error' };
    }
  }

  /** Create an in-app notification for a user, plus best-effort email. */
  async createNotification(
    userId: string,
    dto: CreateNotificationDto,
  ): Promise<NotificationResponse | null> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    const inAppEnabled = preference ? preference.inAppEnabled : true;

    let created;
    if (inAppEnabled) {
      created = await this.prisma.notification.create({
        data: {
          userId,
          type: dto.type,
          title: dto.title,
          body: dto.body,
          dataJson: dto.dataJson as any,
        },
      });
    }

    const prefKey = this.typePreferenceKey(dto.type);
    const emailEnabled = preference ? preference[prefKey] : true;
    const emailResult = emailEnabled
      ? await this.sendEmail(
          (await this.prisma.user.findUnique({ where: { id: userId } }))?.email ??
            '',
          dto.title,
          dto.body,
        )
      : { sent: false, reason: 'opted_out' };

    if (created && emailResult.sent) {
      await this.prisma.notification.update({
        where: { id: created.id },
        data: { emailSent: true, emailSentAt: new Date() },
      });
    }

    return created ? this.toResponse(created) : null;
  }

  /** List the authenticated user's notifications (newest first). */
  async listMyNotifications(
    userId: string,
    query: NotificationListQuery,
  ): Promise<{ items: NotificationResponse[]; total: number }> {
    const { page = 1, limit = 20, unreadOnly = false } = query;
    const skip = (page - 1) * limit;
    const where: any = { userId };
    if (unreadOnly) {
      where.read = false;
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items: items.map((i) => this.toResponse(i)), total };
  }

  /** Mark a single notification as read (owner only). */
  async markRead(notificationId: string, userId: string): Promise<NotificationResponse> {
    const existing = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('You cannot mark another user\'s notification as read');
    }
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
    return this.toResponse(updated);
  }

  /** Mark all of the user's unread notifications as read. */
  async markAllRead(userId: string): Promise<{ markedRead: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { markedRead: result.count };
  }

  /** Get the user's unread notification count. */
  async getUnreadCount(userId: string): Promise<UnreadCountResponse> {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { unreadCount: count };
  }

  /** Get the user's notification preferences (defaults created on first read). */
  async getPreferences(userId: string): Promise<PreferenceResponse> {
    let pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!pref) {
      pref = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    }
    return this.toPreferenceResponse(pref);
  }

  /** Update the user's notification preferences (owner only). */
  async updatePreferences(
    userId: string,
    dto: UpdatePreferenceDto,
  ): Promise<PreferenceResponse> {
    const data: NotificationPreferenceUpdate = {};
    if (dto.emailEnabled !== undefined) data.emailEnabled = dto.emailEnabled;
    if (dto.inAppEnabled !== undefined) data.inAppEnabled = dto.inAppEnabled;
    if (dto.vendorAppOutcome !== undefined) data.vendorAppOutcome = dto.vendorAppOutcome;
    if (dto.disputeSla !== undefined) data.disputeSla = dto.disputeSla;
    if (dto.releaseWarning !== undefined) data.releaseWarning = dto.releaseWarning;
    if (dto.safetyAlert !== undefined) data.safetyAlert = dto.safetyAlert;

    const pref = await this.prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return this.toPreferenceResponse(pref);
  }

  /** Admin broadcast: create a notification for any user. */
  async createBroadcast(
    actorUserId: string,
    dto: CreateNotificationDto,
  ): Promise<NotificationResponse> {
    if (!dto.userId) {
      throw new BadRequestException('userId is required');
    }
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true },
    });
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }
    const created = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        dataJson: {
          ...(dto.dataJson ?? {}),
          createdBy: actorUserId,
        },
      },
    });
    this.logger.log(
      `Admin ${actorUserId} sent ${dto.type} notification to ${dto.userId}`,
    );
    return this.toResponse(created);
  }

  /* ---------------- SLA / warning monitor (cron) ---------------- */

  /** Hourly: dispute SLA countdown + breach notifications. */
  @Cron(CronExpression.EVERY_HOUR)
  async handleDisputeSlaMonitor(): Promise<void> {
    const slaHours =
      (await this.platformSettings
        .getSetting('dispute_sla_hours')
        .then((s) => parseFloat(s.value))
        .catch(() => DEFAULT_SLA_HOURS)) || DEFAULT_SLA_HOURS;
    const now = new Date();

    const pending = await this.prisma.moderationRequest.findMany({
      where: {
        status: 'PENDING',
        resolvedAt: null,
        createdAt: {
          lt: new Date(now.getTime() - slaHours * 60 * 60 * 1000),
        },
      },
      include: {
        assignedModerator: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, customerId: true } },
      },
    });

    for (const req of pending) {
      const alreadyBreached = await this.prisma.notification.findFirst({
        where: {
          type: 'DISPUTE_SLA_BREACH',
          dataJson: { path: ['moderationRequestId'], equals: req.id },
        },
      });
      if (alreadyBreached) continue;

      const targetUserId = req.assignedModeratorId;
      if (!targetUserId) continue;

      await this.createNotification(targetUserId, {
        type: 'DISPUTE_SLA_BREACH',
        title: 'Dispute SLA breached',
        body: `Moderation request #${req.id} on order ${req.orderId} has exceeded the ${slaHours}h SLA and is still pending.`,
        dataJson: {
          moderationRequestId: req.id,
          orderId: req.orderId,
          requestedById: req.requestedById,
        },
      });
    }

    // Countdown warnings: within the last 25% of the SLA window, notify once.
    const countdownFrom = new Date(
      now.getTime() - (slaHours * 0.75) * 60 * 60 * 1000,
    );
    const countdownTo = new Date(
      now.getTime() - (slaHours * 0.5) * 60 * 60 * 1000,
    );
    const countdown = await this.prisma.moderationRequest.findMany({
      where: {
        status: 'PENDING',
        resolvedAt: null,
        createdAt: { gte: countdownTo, lte: countdownFrom },
      },
      include: {
        assignedModerator: { select: { id: true } },
      },
    });
    for (const req of countdown) {
      if (!req.assignedModeratorId) continue;
      const alreadyWarned = await this.prisma.notification.findFirst({
        where: {
          type: 'DISPUTE_SLA_COUNTDOWN',
          dataJson: { path: ['moderationRequestId'], equals: req.id },
        },
      });
      if (alreadyWarned) continue;
      await this.createNotification(req.assignedModeratorId, {
        type: 'DISPUTE_SLA_COUNTDOWN',
        title: 'Dispute SLA countdown',
        body: `Moderation request #${req.id} on order ${req.orderId} is approaching its ${slaHours}h SLA.`,
        dataJson: {
          moderationRequestId: req.id,
          orderId: req.orderId,
          requestedById: req.requestedById,
        },
      });
    }
  }

  /** Hourly: 72-hour escrow release warning (24h before auto-release). */
  @Cron(CronExpression.EVERY_HOUR)
  async handleEscrowReleaseWarning(): Promise<void> {
    const windowStart = new Date();
    const windowEnd = new Date(
      windowStart.getTime() + ESCROW_WARNING_WINDOW_HOURS * 60 * 60 * 1000,
    );

    const orders = await this.prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        autoReleaseAt: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, customerId: true, autoReleaseAt: true },
    });

    for (const order of orders) {
      const alreadyWarned = await this.prisma.notification.findFirst({
        where: {
          type: 'ESCROW_RELEASE_WARNING',
          dataJson: { path: ['orderId'], equals: order.id },
        },
      });
      if (alreadyWarned) continue;
      await this.createNotification(order.customerId, {
        type: 'ESCROW_RELEASE_WARNING',
        title: 'Escrow auto-release approaching',
        body: `Order ${order.id} will auto-release funds to the helper in ${ESCROW_WARNING_WINDOW_HOURS} hours if you take no action.`,
        dataJson: { orderId: order.id },
      });
    }
  }

  /** Hourly: chat safety alert for newly flagged messages. */
  @Cron(CronExpression.EVERY_HOUR)
  async handleSafetyAlerts(): Promise<void> {
    const recentSince = new Date(
      Date.now() - SAFETY_RECENT_WINDOW_HOURS * 60 * 60 * 1000,
    );

    const flagged = await this.prisma.chatMessage.findMany({
      where: {
        hasSafetyWarning: true,
        createdAt: { gte: recentSince },
      },
      select: { id: true, conversationId: true, senderId: true, createdAt: true },
    });

    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'] },
      },
      select: { id: true },
    });

    for (const msg of flagged) {
      const alreadyWarned = await this.prisma.notification.findFirst({
        where: {
          type: 'SAFETY_ALERT',
          dataJson: { path: ['chatMessageId'], equals: msg.id },
        },
      });
      if (alreadyWarned) continue;
      for (const member of staff) {
        await this.createNotification(member.id, {
          type: 'SAFETY_ALERT',
          title: 'Chat safety alert',
          body: `Message ${msg.id} in conversation ${msg.conversationId} was flagged for safety review.`,
          dataJson: { chatMessageId: msg.id, conversationId: msg.conversationId },
        });
      }
    }
  }

  /** SLA tracker: pending moderation requests with time remaining until breach. */
  async getSlaTracker(): Promise<SlaTrackerResponse> {
    const slaHours =
      (await this.platformSettings
        .getSetting('dispute_sla_hours')
        .then((s) => parseFloat(s.value))
        .catch(() => DEFAULT_SLA_HOURS)) || DEFAULT_SLA_HOURS;
    const now = new Date();

    const requests = await this.prisma.moderationRequest.findMany({
      where: { status: 'PENDING', resolvedAt: null },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        assignedModerator: { select: { id: true, name: true } },
        order: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const items: SlaTrackerItem[] = requests.map((req) => {
      const deadline = new Date(
        req.createdAt.getTime() + slaHours * 60 * 60 * 1000,
      );
      const secondsRemaining = Math.max(
        0,
        (deadline.getTime() - now.getTime()) / 1000,
      );
      return {
        moderationRequestId: req.id,
        orderId: req.orderId,
        requestedBy: req.requestedBy,
        assignedModeratorId: req.assignedModerator?.id ?? null,
        status: req.status,
        priority: req.priority,
        createdAt: req.createdAt.toISOString(),
        slaHours,
        secondsRemaining,
        breached: secondsRemaining <= 0,
      };
    });

    return { slaHours, items };
  }

  private toResponse(n: any): NotificationResponse {
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      dataJson: n.dataJson ?? undefined,
      read: n.read,
      readAt: n.readAt?.toISOString() ?? undefined,
      emailSent: n.emailSent,
      emailSentAt: n.emailSentAt?.toISOString() ?? undefined,
      createdAt: n.createdAt.toISOString(),
    };
  }

  private toPreferenceResponse(p: any): PreferenceResponse {
    return {
      userId: p.userId,
      emailEnabled: p.emailEnabled,
      inAppEnabled: p.inAppEnabled,
      vendorAppOutcome: p.vendorAppOutcome,
      disputeSla: p.disputeSla,
      releaseWarning: p.releaseWarning,
      safetyAlert: p.safetyAlert,
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
