import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
  })
  @ApiParam({ name: 'id', description: 'Conversation CUID' })
  @ApiResponse({ status: 200, description: 'Messages list retrieved.' })
  getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.chatService.getMessages(user.id, id);
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
