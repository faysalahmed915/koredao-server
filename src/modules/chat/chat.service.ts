import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { CreateOrGetConversationDto } from './dto/create-or-get-conversation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';

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

  constructor(private readonly prisma: PrismaService) {}

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
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Retrieves messages for a conversation with pagination
   */
  async getMessages(userId: string, conversationId: string) {
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

    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, image: true } },
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

    const safetyCheck = checkSafetyLeakage(dto.content);
    const now = new Date();

    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          conversationId: dto.conversationId,
          senderId: userId,
          content: dto.content,
          attachments: dto.attachments || [],
          hasSafetyWarning: safetyCheck.hasWarning,
          safetyWarningNote: safetyCheck.note || null,
        },
        include: {
          sender: { select: { id: true, name: true, image: true } },
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

    return message;
  }
}
