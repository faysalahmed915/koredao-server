import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { SkipThrottle } from '@nestjs/throttler';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { IncomingHttpHeaders } from 'node:http';

// Allowed browser origins for the real-time chat gateway.
// Mirrors the HTTP CORS allowlist in bootstrap/security.ts: explicit
// localhost dev origins + Render backend + any Vercel preview/prod domain,
// plus extra origins from CORS_ORIGIN. `origin: '*'` can NEVER be used with
// `credentials: true` (browsers reject it), so we validate explicitly.
function isChatOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser clients (curl, Node) have no Origin
  const envOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const defaults = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "https://koredao-server.onrender.com",
  ];
  const allowed = new Set([...defaults, ...envOrigins]);
  if (allowed.has(origin) || allowed.has(origin.replace(/\/$/, ""))) return true;
  // Any Vercel deployment (prod + previews) for this frontend.
  if (origin.startsWith("https://") && origin.endsWith(".vercel.app")) return true;
  return false;
}

// The global ThrottlerGuard (HTTP rate limiting) is registered app-wide and would
// otherwise run against WebSocket events, where it crashes trying to set HTTP
// response headers (res.header). Real-time chat events must bypass it.
@SkipThrottle()
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      if (isChatOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Chat WS CORS blocked origin: ${origin}`), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-correlation-id"],
  },
  namespace: "/chat",
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // userId -> Set of socket ids, for presence broadcast.
  private readonly onlineUsers = new Map<string, Set<string>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    // Authenticate via Better-Auth session cookie (sent automatically with
    // withCredentials: true). Never trust handshake.query.userId — any client
    // can forge it and impersonate another user.
    let userId: string | undefined;
    const cookieHeader =
      (client.handshake.headers as IncomingHttpHeaders)?.cookie;

    if (cookieHeader) {
      try {
        const session = await this.authService.getSession(
          client.handshake.headers as IncomingHttpHeaders
        );
        userId = session?.user?.id;
      } catch {
        // Session invalid or missing — userId stays undefined.
      }
    }

    if (userId) {
      (client.data as { userId?: string }).userId = userId;
      const set = this.onlineUsers.get(userId) ?? new Set<string>();
      set.add(client.id);
      this.onlineUsers.set(userId, set);
      // Best-effort presence heartbeat; ignore failures.
      void this.chatService.updatePresence(userId).catch(() => undefined);
      this.server.emit('presence', { userId, online: true });
    }
    this.logger.log(`WS client connected: ${client.id}${userId ? ` (user=${userId})` : ''} (ns=/chat)`);
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as { userId?: string } | undefined)?.userId;
    if (userId) {
      const set = this.onlineUsers.get(userId);
      if (set) {
        set.delete(client.id);
        if (set.size === 0) {
          this.onlineUsers.delete(userId);
          // Stamp last-seen and broadcast offline presence.
          void this.chatService.updatePresence(userId).catch(() => undefined);
          this.server.emit('presence', { userId, online: false, lastSeenAt: new Date().toISOString() });
        } else {
          this.onlineUsers.set(userId, set);
        }
      }
    }
    this.logger.log(`WS client disconnected: ${client.id}`);
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

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; conversationId: string },
  ) {
    if (!data?.userId || !data?.conversationId) return;
    try {
      // markConversationRead persists isRead and broadcasts 'messages_read' to the room.
      await this.chatService.markConversationRead(data.userId, data.conversationId);
    } catch (err: any) {
      this.logger.warn(`WS mark_read failed: ${err?.message}`);
    }
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
      clientTempId?: string;
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
        clientTempId: data.clientTempId,
      });
    } catch (err: any) {
      this.logger.error(`WS send_message failed: ${err?.message}`);
      // Surface the error back to the sender via the socket's error channel.
      client.emit('message_error', { message: err?.message || 'Failed to send message' });
    }
  }
}
