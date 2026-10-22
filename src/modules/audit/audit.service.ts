import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Log a role change event */
  async logRoleChange({
    targetUserId,
    oldRole,
    newRole,
    changedById,
    reason,
  }: {
    targetUserId: string;
    oldRole: UserRole;
    newRole: UserRole;
    changedById: string;
    reason: string;
  }) {
    return this.prisma.roleChangeAudit.create({
      data: {
        targetUserId,
        oldRole,
        newRole,
        changedById,
        reason,
      },
    });
  }

  /** Log a moderator action */
  async logModeratorAction({
    moderatorId,
    actionType,
    targetId,
    details,
  }: {
    moderatorId: string;
    actionType: string;
    targetId?: string;
    details?: any;
  }) {
    return this.prisma.moderatorActionLog.create({
      data: {
        moderatorId,
        actionType,
        targetId,
        detailsJson: details,
      },
    });
  }

  /** Get role change audit history for a user */
  async getRoleChangeAudit(targetUserId: string) {
    return this.prisma.roleChangeAudit.findMany({
      where: { targetUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        changedBy: {
          select: { id: true, name: true, email: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  /** Get moderator action log for a moderator */
  async getModeratorActionLog(moderatorId: string) {
    return this.prisma.moderatorActionLog.findMany({
      where: { moderatorId },
      orderBy: { createdAt: 'desc' },
      include: {
        moderator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  /** Get all audit logs with filtering */
  async getAuditLogs({
    targetType,
    targetId,
    actorUserId,
    startDate,
    endDate,
  }: {
    targetType?: string;
    targetId?: string;
    actorUserId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (targetType) {
      where.targetType = targetType;
    }
    if (targetId) {
      where.targetId = targetId;
    }
    if (actorUserId) {
      where.actorUserId = actorUserId;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }
}