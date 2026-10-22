import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { AuditService } from './audit.service.js';
import type { RequestWithUser } from '../../common/interfaces/index.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole } from '@prisma/client';
import { MinRole } from '../../common/decorators/min-role.decorator.js';

@Controller('audit')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** POST /audit/role-change - Log a role change event (admin only) */
  @Post('role-change')
  @HttpCode(HttpStatus.CREATED)
  @MinRole(UserRole.ADMIN)
  async logRoleChange(
    @Body() dto: {
      targetUserId: string;
      oldRole: string;
      newRole: string;
      changedById: string;
      reason: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.auditService.logRoleChange({
      targetUserId: dto.targetUserId,
      oldRole: dto.oldRole as any,
      newRole: dto.newRole as any,
      changedById: dto.changedById,
      reason: dto.reason,
    });
  }

  /** POST /audit/moderator-action - Log a moderator action */
  @Post('moderator-action')
  @HttpCode(HttpStatus.CREATED)
  @MinRole(UserRole.MODERATOR)
  async logModeratorAction(
    @Body() dto: {
      moderatorId: string;
      actionType: string;
      targetId?: string;
      details?: any;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.auditService.logModeratorAction({
      moderatorId: dto.moderatorId,
      actionType: dto.actionType,
      targetId: dto.targetId,
      details: dto.details,
    });
  }

  /** GET /audit/role-change/:targetUserId - Get role change audit history */
  @Get('role-change/:targetUserId')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.ADMIN)
  async getRoleChangeAudit(@Param('targetUserId') targetUserId: string) {
    return this.auditService.getRoleChangeAudit(targetUserId);
  }

  /** GET /audit/moderator-action/:moderatorId - Get moderator action log */
  @Get('moderator-action/:moderatorId')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.MODERATOR)
  async getModeratorActionLog(@Param('moderatorId') moderatorId: string) {
    return this.auditService.getModeratorActionLog(moderatorId);
  }

  /** GET /audit/logs - Get all audit logs with filtering */
  @Get('logs')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.ADMIN)
  async getAuditLogs(
    @Query() query: {
      targetType?: string;
      targetId?: string;
      actorUserId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.auditService.getAuditLogs({
      targetType: query.targetType,
      targetId: query.targetId,
      actorUserId: query.actorUserId,
      startDate,
      endDate,
    });
  }
}