import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { MinRole } from '../../common/decorators/min-role.decorator.js';
import { UserRole } from '@prisma/client';
import { ModerationService } from './moderation.service.js';
import type { HelpRequestItem, AdminEscalationItem } from './moderation.service.js';
import {
  RequestModeratorHelpDto,
  ResolveModerationRequestDto,
  RequestAdminEscalationDto,
  ResolveModeratorAdminRequestDto,
} from './dto/moderation.dto.js';

@ApiTags('Moderation')
@Controller('moderation')
@UseGuards(RolesGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /**
   * Customer or vendor requests moderator help on an active job.
   */
  @Post('help-request')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Request moderator help for an active job',
    description:
      'Both customers and vendors can request moderator intervention on active jobs.',
  })
  @ApiResponse({ status: 201, description: 'Help request created.' })
  @ApiResponse({ status: 403, description: 'Not a party to the order or job not active.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  requestHelp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestModeratorHelpDto,
  ) {
    return this.moderationService.requestHelp(user.id, dto);
  }

  /**
   * Get all pending moderation help requests (moderator+ only).
   */
  @Get('help-requests')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get pending moderator help requests',
    description: 'Moderator and above can view all pending help requests.',
  })
  @ApiResponse({ status: 200, description: 'Pending help requests retrieved.' })
  @MinRole(UserRole.MODERATOR)
  getPendingHelpRequests(): Promise<HelpRequestItem[]> {
    return this.moderationService.getPendingHelpRequests();
  }

  /**
   * Get all moderation help requests (moderator+ only).
   */
  @Get('help-requests/all')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get all moderator help requests',
    description: 'Moderator and above can view all help requests with optional status filter.',
  })
  @ApiQuery({ name: 'status', enum: ['PENDING', 'RESOLVED', 'DISMISSED'], required: false })
  @ApiResponse({ status: 200, description: 'All help requests retrieved.' })
  @MinRole(UserRole.MODERATOR)
  getAllHelpRequests(@Query('status') status?: 'PENDING' | 'RESOLVED' | 'DISMISSED'): Promise<HelpRequestItem[]> {
    return this.moderationService.getAllHelpRequests(status);
  }

  /**
   * Resolve a moderation request (moderator+ only).
   * Records which moderator provided the help.
   */
  @Patch('help-requests/:requestId/resolve')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Resolve a moderation help request',
    description: 'Records which moderator resolved the request and their resolution note.',
  })
  @ApiResponse({ status: 200, description: 'Request resolved.' })
  @MinRole(UserRole.MODERATOR)
  resolveRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResolveModerationRequestDto,
  ): Promise<HelpRequestItem> {
    return this.moderationService.resolveRequest(user.id, dto);
  }

  /**
   * Moderator escalates a transaction issue to admin.
   * Moderators cannot access payment data directly.
   */
  @Post('admin-escalation')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Request admin review for a transaction issue',
    description:
      'Moderators escalate transaction-related issues to admin. Moderators cannot view payment data directly.',
  })
  @ApiResponse({ status: 201, description: 'Escalation request created.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  @MinRole(UserRole.MODERATOR)
  requestAdminEscalation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestAdminEscalationDto,
  ) {
    return this.moderationService.requestAdminEscalation(user.id, dto);
  }

  /**
   * Get all pending moderator-to-admin escalation requests (admin only).
   */
  @Get('admin-escalations')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get pending moderator-to-admin escalation requests',
    description: 'Admin only. View pending escalation requests from moderators.',
  })
  @ApiResponse({ status: 200, description: 'Pending escalation requests retrieved.' })
  @MinRole(UserRole.ADMIN)
  getPendingAdminEscalations(): Promise<AdminEscalationItem[]> {
    return this.moderationService.getPendingAdminEscalations();
  }

  /**
   * Get all moderator-to-admin escalation requests (admin only).
   */
  @Get('admin-escalations/all')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get all moderator-to-admin escalation requests',
    description: 'Admin only. View all escalation requests with optional status filter.',
  })
  @ApiQuery({ name: 'status', enum: ['PENDING', 'RESOLVED', 'DISMISSED'], required: false })
  @ApiResponse({ status: 200, description: 'All escalation requests retrieved.' })
  @MinRole(UserRole.ADMIN)
  getAllAdminEscalations(@Query('status') status?: 'PENDING' | 'RESOLVED' | 'DISMISSED'): Promise<AdminEscalationItem[]> {
    return this.moderationService.getAllAdminEscalations(status);
  }

  /**
   * Resolve a moderator-to-admin escalation request (admin only).
   * Records which admin addressed the request.
   */
  @Patch('admin-escalations/:requestId/resolve')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Resolve a moderator-to-admin escalation request',
    description: 'Records which admin addressed the request and their resolution note.',
  })
  @ApiResponse({ status: 200, description: 'Escalation resolved.' })
  @MinRole(UserRole.ADMIN)
  resolveAdminEscalation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResolveModeratorAdminRequestDto,
  ): Promise<AdminEscalationItem> {
    return this.moderationService.resolveAdminEscalation(user.id, dto);
  }

  /**
   * Get moderation history for a specific order.
   */
  @Get('orders/:orderId/history')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get moderation history for an order',
    description: 'View all help requests and escalations for a specific order.',
  })
  @ApiResponse({ status: 200, description: 'Moderation history retrieved.' })
  @MinRole(UserRole.MODERATOR)
  getOrderModerationHistory(@Query('orderId') orderId: string) {
    return this.moderationService.getOrderModerationHistory(orderId);
  }
}
