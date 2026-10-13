import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { MinRole } from '../../common/decorators/min-role.decorator.js';
import { UserRole } from '@prisma/client';
import { ChatService } from './chat.service.js';
import { CreateOrGetConversationDto } from './dto/create-or-get-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@ApiTags('Real-Time Chat & Workspace')
@Controller('chat')
@UseGuards(RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get or initialize a conversation (Order-scoped or Pre-order inquiry)',
  })
  @ApiResponse({ status: 200, description: 'Conversation retrieved or created.' })
  getOrCreateConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrGetConversationDto,
  ) {
    return this.chatService.getOrCreateConversation(user.id, dto);
  }

  @Get('conversations/me')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get all active chat conversations for the current user',
  })
  @ApiResponse({ status: 200, description: 'Conversations list retrieved.' })
  getMyConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.getMyConversations(user.id);
  }

  @Get('conversations/:id/messages')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get message history for a conversation',
    description:
      'Participants plus moderation staff (MODERATOR/ADMIN/SUPER_ADMIN) may read history for safety review.',
  })
  @ApiParam({ name: 'id', description: 'Conversation CUID' })
  @ApiResponse({ status: 200, description: 'Messages list retrieved.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not a participant or staff.' })
  getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.chatService.getMessages(user.id, id, user.role);
  }

  @Get('moderation/conversations')
  @MinRole(UserRole.MODERATOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Moderation: list all conversations for audit (Staff only)',
    description:
      'Read-only listing for MODERATOR/ADMIN/SUPER_ADMIN. Filter flaggedOnly=true to show only conversations containing safety warnings.',
  })
  @ApiResponse({ status: 200, description: 'Conversations list retrieved.' })
  @ApiResponse({ status: 403, description: 'Forbidden: staff only.' })
  getModerationConversations(
    @Query('flaggedOnly') flaggedOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getConversationsForStaff({
      flaggedOnly: flaggedOnly === 'true' || flaggedOnly === '1',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Send a message (REST fallback with zero-leakage safety analysis)',
  })
  @ApiResponse({ status: 201, description: 'Message sent successfully.' })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, dto);
  }
}
