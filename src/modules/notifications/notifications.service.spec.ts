import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let platformSettings: any;

  const userId = 'user-1';
  const otherUserId = 'user-2';

  beforeEach(async () => {
    prisma = {
      notificationPreference: {
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
      },
      notification: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      moderationRequest: {
        findMany: vi.fn(),
      },
      chatMessage: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (arg: any) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return arg(prisma);
      }),
    };

    platformSettings = {
      getSetting: vi.fn().mockResolvedValue({ value: '24' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlatformSettingsService, useValue: platformSettings },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('createNotification', () => {
    it('should create an in-app notification when no preference exists', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({
        id: 'n-1',
        userId,
        type: 'TEST',
        title: 'Hi',
        body: 'Body',
        dataJson: null,
        read: false,
        readAt: null,
        emailSent: false,
        emailSentAt: null,
        createdAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({ id: userId, email: 'a@b.com' });

      const result = await service.createNotification(userId, {
        type: 'TEST',
        title: 'Hi',
        body: 'Body',
      } as any);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('n-1');
      expect(result!.read).toBe(false);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId, type: 'TEST', title: 'Hi' }),
        }),
      );
    });

    it('should respect inAppEnabled=false and skip creating a notification', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({
        id: 'p-1',
        userId,
        inAppEnabled: false,
      });

      const result = await service.createNotification(userId, {
        type: 'TEST',
        title: 'Hi',
        body: 'Body',
      } as any);

      expect(result).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('listMyNotifications', () => {
    it('should return notifications newest first with total', async () => {
      const items = [
        { id: 'n-1', userId, createdAt: new Date('2026-10-01') },
        { id: 'n-2', userId, createdAt: new Date('2026-10-02') },
      ];
      prisma.notification.findMany.mockResolvedValue(items);
      prisma.notification.count.mockResolvedValue(2);

      const result = await service.listMyNotifications(userId, {
        page: 1,
        limit: 20,
        unreadOnly: false,
      });

      expect(result.total).toBe(2);
      expect(result.items[0].id).toBe('n-1');
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter unread only', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.listMyNotifications(userId, {
        page: 2,
        limit: 5,
        unreadOnly: true,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId, read: false },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
      });
    });
  });

  describe('markRead', () => {
    it('should mark the owner\'s notification as read', async () => {
      const existing = {
        id: 'n-1',
        userId,
        read: false,
        type: 'TEST',
        title: 'Hi',
        body: 'Body',
        dataJson: null,
        createdAt: new Date('2026-10-20T10:00:00Z'),
      };
      prisma.notification.findUnique.mockResolvedValue(existing);
      prisma.notification.update.mockResolvedValue({ ...existing, read: true });

      const result = await service.markRead('n-1', userId);

      expect(result.read).toBe(true);
      expect(result.createdAt).toBe('2026-10-20T10:00:00.000Z');
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n-1' },
        data: { read: true, readAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if missing', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markRead('n-99', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not the owner', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n-1',
        userId: otherUserId,
      });
      await expect(service.markRead('n-1', userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('markAllRead', () => {
    it('should mark all unread notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.markAllRead(userId);
      expect(result.markedRead).toBe(3);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId, read: false },
        data: { read: true, readAt: expect.any(Date) },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return the unread count', async () => {
      prisma.notification.count.mockResolvedValue(4);
      const result = await service.getUnreadCount(userId);
      expect(result.unreadCount).toBe(4);
    });
  });

  describe('preferences', () => {
    it('should return defaults when no preference exists', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.notificationPreference.create.mockResolvedValue({
        id: 'p-1',
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        vendorAppOutcome: true,
        disputeSla: true,
        releaseWarning: true,
        safetyAlert: true,
        updatedAt: new Date(),
      });

      const result = await service.getPreferences(userId);
      expect(result.inAppEnabled).toBe(true);
      expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
        data: { userId },
      });
    });

    it('should upsert updated preferences', async () => {
      const existing = {
        id: 'p-1',
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        vendorAppOutcome: true,
        disputeSla: true,
        releaseWarning: true,
        safetyAlert: true,
        updatedAt: new Date(),
      };
      prisma.notificationPreference.findUnique.mockResolvedValue(existing);
      prisma.notificationPreference.upsert.mockResolvedValue({
        ...existing,
        emailEnabled: false,
      });

      const result = await service.updatePreferences(userId, {
        emailEnabled: false,
      } as any);

      expect(result.emailEnabled).toBe(false);
      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: { emailEnabled: false },
        create: expect.objectContaining({ userId, emailEnabled: false }),
      });
    });
  });

  describe('createBroadcast', () => {
    it('should create a notification for the target user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        email: 'target@koredao.com',
      });
      prisma.notification.create.mockResolvedValue({
        id: 'n-broadcast',
        userId: 'target-1',
        type: 'TEST',
        title: 'Hello',
        body: 'Body',
        dataJson: { createdBy: 'admin-1' },
        read: false,
        readAt: null,
        emailSent: false,
        emailSentAt: null,
        createdAt: new Date(),
      });

      const result = await service.createBroadcast('admin-1', {
        userId: 'target-1',
        type: 'TEST',
        title: 'Hello',
        body: 'Body',
      } as any);

      expect(result.id).toBe('n-broadcast');
      expect(result.dataJson?.createdBy).toBe('admin-1');
    });

    it('should throw NotFoundException if target user missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.createBroadcast('admin-1', {
          userId: 'nope',
          type: 'TEST',
          title: 'Hi',
          body: 'Body',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSlaTracker', () => {
    it('should return pending moderation requests with seconds remaining', async () => {
      const now = new Date('2026-10-20T10:00:00Z');
      vi.setSystemTime(now);
      const created = new Date('2026-10-20T08:00:00Z'); // 2h ago, 22h remaining of 24h SLA
      prisma.moderationRequest.findMany.mockResolvedValue([
        {
          id: 'mr-1',
          orderId: 'ord-1',
          status: 'PENDING',
          resolvedAt: null,
          priority: 'HIGH',
          createdAt: created,
          requestedBy: { id: 'u-1', name: 'Alice', email: 'a@b.com' },
          assignedModerator: { id: 'm-1', name: 'Mod' },
          order: { id: 'ord-1' },
        },
      ]);

      const result = await service.getSlaTracker();

      expect(result.slaHours).toBe(24);
      expect(result.items[0].moderationRequestId).toBe('mr-1');
      expect(result.items[0].breached).toBe(false);
      expect(result.items[0].secondsRemaining).toBeCloseTo(22 * 3600, -1);
      vi.useRealTimers();
    });
  });
});
