import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import type {
  NotificationListQuery,
  MarkReadDto,
  UpdatePreferenceDto,
  CreateNotificationDto,
  NotificationResponse,
  PreferenceResponse,
  UnreadCountResponse,
  SlaTrackerResponse,
} from './notification.dto.js';
import { UserRole } from '@prisma/client';
import type { RequestWithUser } from '../../common/interfaces/index.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { MinRole } from '../../common/decorators/min-role.decorator.js';

@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** GET /notifications/me - List the authenticated user's notifications */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async listMyNotifications(
    @Req() req: RequestWithUser,
    @Query() query: NotificationListQuery,
  ): Promise<{ items: NotificationResponse[]; total: number }> {
    return this.notifications.listMyNotifications(req.user.id, query);
  }

  /** GET /notifications/unread-count - Unread notification count */
  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  async getUnreadCount(
    @Req() req: RequestWithUser,
  ): Promise<UnreadCountResponse> {
    return this.notifications.getUnreadCount(req.user.id);
  }

  /** PATCH /notifications/:id/read - Mark a notification as read (owner only) */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Param() dto: MarkReadDto,
    @Req() req: RequestWithUser,
  ): Promise<NotificationResponse> {
    return this.notifications.markRead(dto.notificationId, req.user.id);
  }

  /** PATCH /notifications/read-all - Mark all the user's notifications as read */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(
    @Req() req: RequestWithUser,
  ): Promise<{ markedRead: number }> {
    return this.notifications.markAllRead(req.user.id);
  }

  /** GET /notifications/preferences - Get notification preferences */
  @Get('preferences')
  @HttpCode(HttpStatus.OK)
  async getPreferences(
    @Req() req: RequestWithUser,
  ): Promise<PreferenceResponse> {
    return this.notifications.getPreferences(req.user.id);
  }

  /** PATCH /notifications/preferences - Update notification preferences */
  @Patch('preferences')
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @Req() req: RequestWithUser,
    @Body() dto: UpdatePreferenceDto,
  ): Promise<PreferenceResponse> {
    return this.notifications.updatePreferences(req.user.id, dto);
  }

  /** POST /notifications - Admin broadcast notification to any user */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @MinRole(UserRole.ADMIN)
  async createBroadcast(
    @Req() req: RequestWithUser,
    @Body() dto: CreateNotificationDto,
  ): Promise<NotificationResponse | null> {
    return this.notifications.createBroadcast(req.user.id, dto);
  }

  /** GET /notifications/sla-tracker - Pending moderation requests vs SLA (moderator+) */
  @Get('sla-tracker')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.MODERATOR)
  async getSlaTracker(): Promise<SlaTrackerResponse> {
    return this.notifications.getSlaTracker();
  }
}
