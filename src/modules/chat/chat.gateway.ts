import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { SkipThrottle } from '@nestjs/throttler';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service.js';

// The global ThrottlerGuard (HTTP rate limiting) is registered app-wide and would
// otherwise run against WebSocket events, where it crashes trying to set HTTP
// response headers (res.header). Real-time chat events must bypass it.
@SkipThrottle()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`WS client connected: ${client.id} (ns=/chat)`);
  }

  /**
   * Register the initialized Socket.io server with the ChatService so that
   * messages created via the REST API are also broadcast live to the room.
   */
  afterInit(): void {
    this.chatService.setSocketServer(this.server);
    this.logger.log('ChatGateway initialized; Socket.io server registered for live broadcast');
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId) return;
    const room = `conversation_${data.conversationId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    // NOTE: intentionally no return value. Returning a value from a
    // @SubscribeMessage handler makes NestJS's ws-proxy attempt to treat it as
    // an HTTP response (res.header), which throws and aborts the handler.
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; userName: string; isTyping: boolean },
  ) {
    if (!data?.conversationId) return;
    const room = `conversation_${data.conversationId}`;
    client.to(room).emit('user_typing', data);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      userId: string;
      conversationId: string;
      content: string;
      attachments?: string[];
      checkpointId?: string;
    },
  ) {
    try {
      // The service persists the message AND broadcasts it to the room, so all
      // joined participants (including the sender) receive 'new_message' live.
      await this.chatService.sendMessage(data.userId, {
        conversationId: data.conversationId,
        content: data.content,
        attachments: data.attachments,
        checkpointId: data.checkpointId,
      });
    } catch (err: any) {
      this.logger.error(`WS send_message failed: ${err?.message}`);
      // Surface the error back to the sender via the socket's error channel.
      client.emit('message_error', { message: err?.message || 'Failed to send message' });
    }
  }
}
