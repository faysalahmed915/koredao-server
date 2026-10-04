import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service.js';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('join_conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId) return;
    const room = `conversation_${data.conversationId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { status: 'joined', room };
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
    },
  ) {
    try {
      const message = await this.chatService.sendMessage(data.userId, {
        conversationId: data.conversationId,
        content: data.content,
        attachments: data.attachments,
      });

      const room = `conversation_${data.conversationId}`;
      this.server.to(room).emit('new_message', message);
      return { status: 'sent', message };
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }
}
