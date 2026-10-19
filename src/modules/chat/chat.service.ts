import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import type { Server } from 'socket.io';
import { PrismaService } from '../../core/database/prisma.service.js';
import { CreateOrGetConversationDto } from './dto/create-or-get-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { UserRole } from '@prisma/client';

/** Roles permitted to audit any conversation (read-only moderation). */
const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.MODERATOR,
];

const isStaffRole = (role?: UserRole | string): boolean =>
  !!role && STAFF_ROLES.includes(role as UserRole);

export function checkSafetyLeakage(content: string): { hasWarning: boolean; note?: string } {
  const phoneRegex = /(?:\+?88)?01[3-9]\d{8}|\b\d{3}[-.\s]??\d{3}[-.\s]??\d{4}\b/;
  const contactRegex =
    /whatsapp|wa\.me|t\.me|telegram|imo\b|viber|facebook\.com|fb\.com|instagram\.com|@gmail\.com|@yahoo\.com/i;
  const offPlatformRegex =
    /pay\s*outside|direct\s*bkash|personal\s*account|cash\s*in\s*hand|direct\s*nagad/i;

  if (phoneRegex.test(content) || contactRegex.test(content)) {
    return {
      hasWarning: true,
      note: 'Safety Notice: Sharing personal phone or off-platform contacts is restricted. Stay on KoreDao to ensure your escrow refund guarantee.',
    };
  }

  if (offPlatformRegex.test(content)) {
    return {
      hasWarning: true,
      note: 'Safety Notice: Off-platform payment requests violate KoreDao policy and void escrow dispute arbitration.',
    };
  }

  return { hasWarning: false };
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  /**
   * Injected by ChatGateway after the Socket.io server is initialized so that
   * REST-created messages are also broadcast live to the conversation room.
   * (Setter injection avoids a circular dependency between service & gateway.)
   */
  private socketServer?: Server;

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Called by the ChatGateway on init to register the live Socket.io server.
   */
  setSocketServer(server: Server): void {
    this.socketServer = server;
  }

  /**
   * Emits a newly created message to everyone currently joined to the
   * conversation room (best-effort; safe to call when no WS server is set).
   */
  private broadcastNewMessage(conversationId: string, message: unknown): void {
    if (!this.socketServer) return;
    this.socketServer
      .to(`conversation_${conversationId}`)
      .emit('new_message', message);
  }

  /**
   * Retrieves or initializes a conversation between client and helper (order-scoped or pre-order inquiry)
   */
  async getOrCreateConversation(userId: string, dto: CreateOrGetConversationDto) {
    if (dto.orderId) {
      // Order-scoped chat
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: { vendorProfile: true },
      });

      if (!order) {
        throw new NotFoundException(`Order '${dto.orderId}' not found`);
      }

      const isCustomer = order.customerId === userId;
      const isVendor = order.vendorProfile.userId === userId;

      if (!isCustomer && !isVendor) {
        throw new ForbiddenException('You are not a participant in this order');
      }

      let conv = await this.prisma.conversation.findUnique({
        where: { orderId: dto.orderId },
        include: {
          customer: { select: { id: true, name: true, image: true, email: true } },
          vendorProfile: {
            select: {
              id: true,
              userId: true,
              university: true,
              department: true,
              user: { select: { id: true, name: true, image: true } },
            },
          },
        },
      });

      if (!conv) {
        conv = await this.prisma.conversation.create({
          data: {
            orderId: dto.orderId,
            customerId: order.customerId,
            vendorProfileId: order.vendorProfileId,
          },
          include: {
            customer: { select: { id: true, name: true, image: true, email: true } },
            vendorProfile: {
              select: {
                id: true,
                userId: true,
                university: true,
                department: true,
                user: { select: { id: true, name: true, image: true } },
              },
            },
          },
        });
      }

      return conv;
    }

    if (dto.vendorProfileId) {
      // Pre-order direct inquiry chat
      const vendorProfile = await this.prisma.vendorProfile.findUnique({
        where: { id: dto.vendorProfileId },
      });

      if (!vendorProfile) {
        throw new NotFoundException('Vendor profile not found');
      }

      let conv = await this.prisma.conversation.findFirst({
        where: {
          customerId: userId,
          vendorProfileId: dto.vendorProfileId,
          orderId: null,
        },
        include: {
          customer: { select: { id: true, name: true, image: true, email: true } },
          vendorProfile: {
            select: {
              id: true,
              userId: true,
              university: true,
              department: true,
              user: { select: { id: true, name: true, image: true } },
            },
          },
        },
      });

      if (!conv) {
        conv = await this.prisma.conversation.create({
          data: {
            customerId: userId,
            vendorProfileId: dto.vendorProfileId,
          },
          include: {
            customer: { select: { id: true, name: true, image: true, email: true } },
            vendorProfile: {
              select: {
                id: true,
                userId: true,
                university: true,
                department: true,
                user: { select: { id: true, name: true, image: true } },
              },
            },
          },
        });
      }

      return conv;
    }

    throw new ConflictException('Either orderId or vendorProfileId must be provided');
  }

  /**
   * Retrieves all conversations involving the current user
   */

  async getMyConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        OR: [
          { customerId: userId },
          { vendorProfile: { userId } },
        ],
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
      select: {
        id: true,
        orderId: true,
        customerId: true,
        vendorProfileId: true,
        lastMessageAt: true,

        customer: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true,
            lastSeenAt: true,
          },
        },

        vendorProfile: {
          select: {
            id: true,
            userId: true,
            university: true,
            department: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                lastSeenAt: true,
              },
            },
          },
        },

        order: {
          select: {
            id: true,
            orderNumber: true,
            title: true,
            status: true,
          },
        },

        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
          },
        },
      },
    });
  }

  /**
   * Marks all incoming (not sent by the caller) messages in a conversation as read
   * and broadcasts a `messages_read` event so the sender sees real-time read receipts.
   * Returns the ids that were updated.
   */
  async markConversationRead(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { vendorProfile: true },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    const isCustomer = conv.customerId === userId;
    const isVendor = conv.vendorProfile.userId === userId;

    if (!isCustomer && !isVendor) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const unread = await this.prisma.chatMessage.findMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      select: { id: true },
    });

    if (unread.length === 0) {
      return { updatedCount: 0, messageIds: [] as string[] };
    }

    const ids = unread.map((m) => m.id);
    await this.prisma.chatMessage.updateMany({
      where: { id: { in: ids } },
      data: { isRead: true },
    });

    // Notify the room (sender) that these messages are now read.
    if (this.socketServer) {
      this.socketServer
        .to(`conversation_${conversationId}`)
        .emit('messages_read', { conversationId, messageIds: ids, readBy: userId });
    }

    this.logger.log(`Marked ${ids.length} message(s) read in conversation=${conversationId} by user=${userId}`);
    return { updatedCount: ids.length, messageIds: ids };
  }

  /**
   * Persists the caller's presence heartbeat (last-seen timestamp). Used by the
   * WebSocket gateway on connect/disconnect and can also be called periodically.
   */
  async updatePresence(userId: string) {
    const now = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: now },
    });
    return { userId, lastSeenAt: now };
  }

  /**
   * Moderation view: lists all conversations across the platform for staff auditing.
   * Supports filtering to only conversations flagged with a safety warning (zero-leakage
   * alerts) and simple pagination. Never returns message bodies here — staff open a
   * specific conversation via `getMessages`.
   */
  async getConversationsForStaff(options: {
    flaggedOnly?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = options.flaggedOnly
      ? { messages: { some: { hasSafetyWarning: true } } }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, image: true, email: true } },
          vendorProfile: {
            select: {
              id: true,
              userId: true,
              university: true,
              department: true,
              user: { select: { id: true, name: true, image: true } },
            },
          },
          order: { select: { id: true, orderNumber: true, title: true, status: true } },
          _count: {
            select: {
              messages: { where: { hasSafetyWarning: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Retrieves messages for a conversation.
   * Participants (customer/helper) plus moderation staff (MODERATOR/ADMIN/SUPER_ADMIN)
   * may read the history for safety review and dispute arbitration.
   */
  async getMessages(userId: string, conversationId: string, role?: UserRole | string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { vendorProfile: true },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    const isCustomer = conv.customerId === userId;
    const isVendor = conv.vendorProfile.userId === userId;

    if (!isCustomer && !isVendor && !isStaffRole(role)) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, image: true } },
        checkpoint: {
          select: { id: true, title: true, targetDate: true, status: true },
        },
      },
    });
  }

  /**
   * Sends a message with zero-leakage safety analysis
   */
  async sendMessage(userId: string, dto: SendMessageDto) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: { vendorProfile: true },
    });

    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    const isCustomer = conv.customerId === userId;
    const isVendor = conv.vendorProfile.userId === userId;

    if (!isCustomer && !isVendor) {
      throw new ForbiddenException('You are not authorized to send messages in this conversation');
    }

    // Validate the optional milestone checkpoint "target" reference.
    // A checkpoint may only be linked if it belongs to the same order as the
    // conversation (order-scoped chats only — pre-order inquiries have no order).
    let checkpointId: string | null = null;
    if (dto.checkpointId) {
      if (!conv.orderId) {
        throw new ConflictException(
          'Milestone targets can only be referenced in order-scoped conversations',
        );
      }

      const checkpoint = await this.prisma.projectCheckpoint.findUnique({
        where: { id: dto.checkpointId },
      });

      if (!checkpoint || checkpoint.orderId !== conv.orderId) {
        throw new ForbiddenException(
          'The referenced milestone checkpoint does not belong to this order',
        );
      }

      checkpointId = checkpoint.id;
    }

    // Include attachment URLs in the leakage scan so external-contact links
    // shared as "files" are still flagged.
    const scanText = [dto.content, ...(dto.attachments || [])].join(' ');
    const safetyCheck = checkSafetyLeakage(scanText);
    const now = new Date();

    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          conversationId: dto.conversationId,
          senderId: userId,
          content: dto.content,
          attachments: dto.attachments || [],
          checkpointId,
          hasSafetyWarning: safetyCheck.hasWarning,
          safetyWarningNote: safetyCheck.note || null,
        },
        include: {
          sender: { select: { id: true, name: true, image: true } },
          checkpoint: {
            select: { id: true, title: true, targetDate: true, status: true },
          },
        },
      }),
      this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { lastMessageAt: now },
      }),
    ]);

    if (safetyCheck.hasWarning) {
      this.logger.warn(`Safety alert triggered in conversation=${dto.conversationId} by user=${userId}`);
    }

    // Broadcast live to the conversation room so all joined participants receive
    // the message in real time (covers the REST send path, which previously
    // only relied on the WebSocket handler).
    // Echo clientTempId (not persisted) so the sender can idempotently replace
    // its optimistic tmp-* placeholder instead of appending a duplicate key.
    this.broadcastNewMessage(dto.conversationId, { ...message, clientTempId: dto.clientTempId });

    return { ...message, clientTempId: dto.clientTempId };
  }
}
