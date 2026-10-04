import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService, checkSafetyLeakage } from './chat.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: {
    order: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    vendorProfile: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    conversation: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    chatMessage: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: vi.fn(),
      },
      vendorProfile: {
        findUnique: vi.fn(),
      },
      conversation: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      chatMessage: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((arr) => Promise.all(arr)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('checkSafetyLeakage', () => {
    it('should detect Bangladeshi phone numbers and trigger safety warning', () => {
      const res = checkSafetyLeakage('Please call me at 01712345678 to discuss.');
      expect(res.hasWarning).toBe(true);
      expect(res.note).toContain('off-platform contacts is restricted');
    });

    it('should detect WhatsApp or external contact links', () => {
      const res = checkSafetyLeakage('Message me on whatsapp or t.me/myhandle');
      expect(res.hasWarning).toBe(true);
    });

    it('should detect off-platform payment attempts', () => {
      const res = checkSafetyLeakage('Can you pay outside via direct bkash?');
      expect(res.hasWarning).toBe(true);
      expect(res.note).toContain('Off-platform payment requests violate KoreDao policy');
    });

    it('should pass academic text without warning', () => {
      const res = checkSafetyLeakage('Here is the equation solution for problem 3.');
      expect(res.hasWarning).toBe(false);
    });
  });

  describe('getOrCreateConversation', () => {
    it('should retrieve existing order conversation for valid participant', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customerId: 'cust-1',
        vendorProfileId: 'vp-1',
        vendorProfile: { userId: 'vend-1' },
      });

      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        orderId: 'ord-1',
        customerId: 'cust-1',
        vendorProfileId: 'vp-1',
      });

      const res = await service.getOrCreateConversation('cust-1', { orderId: 'ord-1' });
      expect(res.id).toBe('conv-1');
    });

    it('should reject non-participant user trying to open order chat', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customerId: 'cust-1',
        vendorProfile: { userId: 'vend-1' },
      });

      await expect(
        service.getOrCreateConversation('stranger-99', { orderId: 'ord-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create pre-order inquiry conversation with vendor', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
      });
      prisma.conversation.findFirst.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue({
        id: 'conv-inquiry',
        customerId: 'cust-1',
        vendorProfileId: 'vp-1',
        orderId: null,
      });

      const res = await service.getOrCreateConversation('cust-1', { vendorProfileId: 'vp-1' });
      expect(res.id).toBe('conv-inquiry');
    });
  });

  describe('sendMessage', () => {
    it('should flag message with safety warning when leakage detected', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        customerId: 'cust-1',
        vendorProfile: { userId: 'vend-1' },
      });

      prisma.chatMessage.create.mockResolvedValue({
        id: 'msg-1',
        content: 'Call me at 01812345678',
        hasSafetyWarning: true,
      });
      prisma.conversation.update.mockResolvedValue({});

      const res = await service.sendMessage('cust-1', {
        conversationId: 'conv-1',
        content: 'Call me at 01812345678',
      });

      expect(res.hasSafetyWarning).toBe(true);
      expect(prisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hasSafetyWarning: true,
          }),
        }),
      );
    });

    it('should reject unauthorized user sending message to conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        customerId: 'cust-1',
        vendorProfile: { userId: 'vend-1' },
      });

      await expect(
        service.sendMessage('intruder', {
          conversationId: 'conv-1',
          content: 'Hello',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
