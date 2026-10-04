import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { UserRole, OrderStatus, EscrowStatus, VerificationStatus } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    order: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    assignment: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    conversation: {
      findMany: ReturnType<typeof vi.fn>;
    };
    gig: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    vendorProfile: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    customerProfile: {
      count: ReturnType<typeof vi.fn>;
    };
    user: {
      count: ReturnType<typeof vi.fn>;
    };
    escrowHolding: {
      findMany: ReturnType<typeof vi.fn>;
    };
    bid: {
      findMany: ReturnType<typeof vi.fn>;
    };
    chatMessage: {
      count: ReturnType<typeof vi.fn>;
    };
    walletTransaction: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      assignment: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      conversation: {
        findMany: vi.fn(),
      },
      gig: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      vendorProfile: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      customerProfile: {
        count: vi.fn(),
      },
      user: {
        count: vi.fn(),
      },
      escrowHolding: {
        findMany: vi.fn(),
      },
      bid: {
        findMany: vi.fn(),
      },
      chatMessage: {
        count: vi.fn(),
      },
      walletTransaction: {
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('Customer Dashboard', () => {
    it('should aggregate customer active orders, assignments and recommendations', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          orderNumber: 'KD-2026-0001',
          title: 'Calculus Solutions',
          totalAmount: 1200,
          status: OrderStatus.IN_PROGRESS,
          deadline: new Date(),
          vendorProfile: {
            university: 'BUET',
            user: { name: 'Tanvir', image: null },
          },
          escrowHolding: { status: EscrowStatus.HELD, amount: 1200 },
        },
        {
          id: 'ord-2',
          orderNumber: 'KD-2026-0002',
          title: 'Physics Lab',
          totalAmount: 800,
          status: OrderStatus.COMPLETED,
          deadline: new Date(),
          vendorProfile: {
            university: 'DU',
            user: { name: 'Fahim', image: null },
          },
          escrowHolding: { status: EscrowStatus.RELEASED_TO_VENDOR, amount: 800 },
        },
      ]);

      prisma.assignment.findMany.mockResolvedValue([
        {
          id: 'asg-1',
          title: 'Differential Equations',
          subject: 'MATH 201',
          budgetMin: 500,
          budgetMax: 1000,
          bidsCount: 3,
          status: 'OPEN',
          createdAt: new Date(),
        },
      ]);

      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv-1',
          messages: [{ id: 'msg-1' }, { id: 'msg-2' }],
        },
      ]);

      prisma.gig.findMany.mockResolvedValue([
        {
          id: 'gig-1',
          slug: 'circuit-theory',
          title: 'Circuit Theory Report',
          category: 'LAB_REPORT',
          priceFrom: 600,
          rating: 4.9,
          totalReviews: 12,
          coverImages: ['https://example.com/cover.jpg'],
          vendorProfile: {
            university: 'BUET',
            user: { name: 'Tanvir', image: null },
          },
        },
      ]);

      const res = await service.getMetrics('cust-1', UserRole.CUSTOMER);

      expect(res.role).toBe('CUSTOMER');
      if (res.role === 'CUSTOMER') {
        expect(res.stats.activeOrdersCount).toBe(1);
        expect(res.stats.completedOrdersCount).toBe(1);
        expect(res.stats.openAssignmentsCount).toBe(1);
        expect(res.stats.totalBidsReceived).toBe(3);
        expect(res.stats.unreadMessagesCount).toBe(2);
        expect(res.recentOrders.length).toBe(2);
        expect(res.recentAssignments.length).toBe(1);
        expect(res.recommendedGigs.length).toBe(1);
      }
    });
  });

  describe('Vendor Dashboard', () => {
    it('should aggregate vendor earnings, active orders, and bids', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'vend-1',
        verificationStatus: VerificationStatus.APPROVED,
        rating: 4.95,
        totalReviews: 30,
        wallet: {
          balance: 8500,
          pendingBalance: 2400,
          totalEarned: 24000,
          totalWithdrawn: 13100,
        },
      });

      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          orderNumber: 'KD-2026-0001',
          title: 'Calculus Solutions',
          totalAmount: 1200,
          status: OrderStatus.IN_PROGRESS,
          deadline: new Date(Date.now() + 86400000),
          customer: {
            name: 'Saad',
            customerProfile: { university: 'DU' },
          },
          checkpoints: [{ id: 'cp-1' }],
        },
      ]);

      prisma.bid.findMany.mockResolvedValue([
        {
          id: 'bid-1',
          assignmentId: 'asg-1',
          proposedPrice: 1500,
          deliveryDays: 2,
          status: 'PENDING',
          createdAt: new Date(),
          assignment: { title: 'Differential Equations' },
        },
      ]);

      prisma.gig.findMany.mockResolvedValue([
        {
          id: 'gig-1',
          slug: 'circuit-analysis',
          title: 'Circuit Analysis',
          priceFrom: 600,
          orderCount: 15,
          rating: 4.9,
          isActive: true,
        },
      ]);

      prisma.conversation.findMany.mockResolvedValue([]);

      const res = await service.getMetrics('vend-1', UserRole.VENDOR);

      expect(res.role).toBe('VENDOR');
      if (res.role === 'VENDOR') {
        expect(res.isApproved).toBe(true);
        expect(res.stats.availableBalance).toBe(8500);
        expect(res.stats.pendingEscrowBalance).toBe(2400);
        expect(res.stats.inProgressOrdersCount).toBe(1);
        expect(res.stats.activeBidsCount).toBe(1);
        expect(res.urgentOrders.length).toBe(1);
        expect(res.recentBids.length).toBe(1);
        expect(res.myGigs.length).toBe(1);
      }
    });

    it('should return unapproved status if vendor profile is pending or not created', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-pending',
        userId: 'vend-pending',
        verificationStatus: VerificationStatus.PENDING,
        rating: 0,
        totalReviews: 0,
        wallet: null,
      });

      prisma.order.findMany.mockResolvedValue([]);
      prisma.bid.findMany.mockResolvedValue([]);
      prisma.gig.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);

      const res = await service.getMetrics('vend-pending', UserRole.VENDOR);

      expect(res.role).toBe('VENDOR');
      if (res.role === 'VENDOR') {
        expect(res.isApproved).toBe(false);
        expect(res.verificationStatus).toBe(VerificationStatus.PENDING);
      }
    });
  });

  describe('Admin Dashboard', () => {
    it('should aggregate platform-wide telemetry, GMV, escrow and verification queue', async () => {
      prisma.user.count.mockResolvedValue(150);
      prisma.vendorProfile.count.mockResolvedValue(45);
      prisma.customerProfile.count.mockResolvedValue(100);
      prisma.gig.count.mockResolvedValue(60);
      prisma.assignment.count.mockResolvedValue(30);
      prisma.order.count.mockResolvedValue(80);

      prisma.escrowHolding.findMany.mockResolvedValue([
        { amount: 1200 },
        { amount: 2400 },
      ]);

      prisma.order.findMany.mockImplementation((args: any) => {
        if (args?.where?.status === OrderStatus.COMPLETED) {
          return Promise.resolve([
            { totalAmount: 2000, platformFee: 200 },
            { totalAmount: 1500, platformFee: 150 },
          ]);
        }
        if (args?.where?.status === OrderStatus.DISPUTED) {
          return Promise.resolve([
            {
              id: 'ord-disp-1',
              orderNumber: 'KD-2026-9999',
              title: 'Disputed Assignment',
              totalAmount: 1000,
              disputeReason: 'Work was incomplete',
              createdAt: new Date(),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      prisma.vendorProfile.findMany.mockResolvedValue([
        {
          id: 'vp-pen-1',
          userId: 'usr-pen-1',
          university: 'BUET',
          department: 'CSE',
          idCardUrl: 'https://example.com/id.jpg',
          createdAt: new Date(),
          user: { name: 'Applicant One', email: 'one@buet.ac.bd' },
        },
      ]);

      prisma.chatMessage.count.mockResolvedValue(3);

      prisma.walletTransaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          amount: 5000,
          type: 'WITHDRAWAL',
          description: 'Payout via bKash',
          payoutMethod: 'bKash',
          createdAt: new Date(),
        },
      ]);

      const res = await service.getMetrics('admin-1', UserRole.SUPER_ADMIN);

      expect(res.role).toBe('ADMIN');
      if (res.role === 'ADMIN') {
        expect(res.stats.totalUsers).toBe(150);
        expect(res.stats.totalEscrowHeld).toBe(3600);
        expect(res.stats.totalPlatformRevenue).toBe(350);
        expect(res.stats.totalGMV).toBe(3500);
        expect(res.stats.pendingVerificationsCount).toBe(1);
        expect(res.stats.disputedOrdersCount).toBe(1);
        expect(res.stats.safetyAlertsCount).toBe(3);
        expect(res.pendingVerifications.length).toBe(1);
        expect(res.disputedOrders.length).toBe(1);
        expect(res.recentTransactions.length).toBe(1);
      }
    });
  });
});
