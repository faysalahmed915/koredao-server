import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrdersService } from './orders.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { EscrowStatus, OrderStatus } from '@prisma/client';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    order: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    escrowHolding: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    vendorWallet: {
      upsert: ReturnType<typeof vi.fn>;
    };
    walletTransaction: {
      create: ReturnType<typeof vi.fn>;
    };
    vendorProfile: {
      update: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    gig: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    assignment: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    bid: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      order: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      escrowHolding: {
        create: vi.fn(),
        update: vi.fn(),
      },
      vendorWallet: {
        upsert: vi.fn(),
      },
      walletTransaction: {
        create: vi.fn(),
      },
      vendorProfile: {
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      gig: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      assignment: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      bid: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((arg) => {
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        return Promise.all(arg);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('create (from Gig)', () => {
    it('should initialize order with 10% platform fee and AWAITING_PAYMENT escrow', async () => {
      prisma.gig.findUnique.mockResolvedValue({
        id: 'gig-1',
        title: 'Calculus Assignment Help',
        isActive: true,
        vendorProfileId: 'vp-1',
        vendorProfile: { userId: 'vendor-1' },
        packages: [
          { name: 'Standard', price: 1000, deliveryDays: 3, revisions: 2 },
        ],
      });

      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-12345',
        totalAmount: 1000,
        platformFee: 100,
        netVendorAmount: 900,
        status: OrderStatus.PENDING_PAYMENT,
        customerId: 'cust-1',
        vendorProfile: { userId: 'vendor-1' },
      };

      prisma.order.create.mockResolvedValue(mockOrder);
      prisma.escrowHolding.create.mockResolvedValue({});
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.create('cust-1', {
        gigId: 'gig-1',
        packageIndex: 0,
      });

      expect(result).toEqual(mockOrder);
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalAmount: 1000,
            platformFee: 100,
            netVendorAmount: 900,
            maxRevisions: 2,
          }),
        }),
      );
    });
  });

  describe('fundEscrow', () => {
    it('should lock funds in escrow and update order status to ESCROW_HELD', async () => {
      const mockOrder = {
        id: 'ord-1',
        totalAmount: 1000,
        status: OrderStatus.PENDING_PAYMENT,
        customerId: 'cust-1',
        vendorProfile: { userId: 'vendor-1' },
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await service.fundEscrow('ord-1', 'AAMARPAY', 'TXN-AAMAR-123');

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-1' },
          data: { status: OrderStatus.ESCROW_HELD },
        }),
      );
    });
  });

  describe('submitDelivery', () => {
    it('should allow helper to submit deliverables and start 72-hour timer when escrow is funded', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: OrderStatus.ESCROW_HELD,
        vendorProfile: { userId: 'vendor-1' },
      });
      prisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: OrderStatus.DELIVERED,
      });

      const result = await service.submitDelivery('vendor-1', 'ord-1', {
        deliveryFiles: ['https://cdn.example.com/solution.pdf'],
        deliveryNotes: 'Here is the completed assignment.',
      });

      expect(result.status).toBe(OrderStatus.DELIVERED);
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.DELIVERED,
            autoReleaseAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should prevent helper from submitting deliverable if escrow is not funded', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: OrderStatus.PENDING_PAYMENT,
        vendorProfile: { userId: 'vendor-1' },
      });

      await expect(
        service.submitDelivery('vendor-1', 'ord-1', {
          deliveryFiles: ['https://cdn.example.com/solution.pdf'],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('acceptDelivery', () => {
    it('should complete order, release escrow, and credit helper wallet with net amount', async () => {
      const mockOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-999',
        customerId: 'cust-1',
        vendorProfileId: 'vp-1',
        netVendorAmount: 900,
        status: OrderStatus.DELIVERED,
        vendorProfile: { userId: 'vendor-1' },
      };
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.vendorWallet.upsert.mockResolvedValue({ id: 'w-1', balance: 900 });

      await service.acceptDelivery('cust-1', 'ord-1');

      expect(prisma.escrowHolding.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EscrowStatus.RELEASED_TO_VENDOR,
          }),
        }),
      );
      expect(prisma.vendorWallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { vendorProfileId: 'vp-1' },
        }),
      );
    });
  });

  describe('requestRevision', () => {
    it('should reset order to IN_PROGRESS and pause auto-release timer', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customerId: 'cust-1',
        status: OrderStatus.DELIVERED,
        maxRevisions: 2,
        usedRevisions: 0,
      });
      prisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: OrderStatus.IN_PROGRESS,
        usedRevisions: 1,
      });

      const result = await service.requestRevision('cust-1', 'ord-1', {
        revisionNotes: 'Please correct page 2 calculation.',
      });

      expect(result.status).toBe(OrderStatus.IN_PROGRESS);
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.IN_PROGRESS,
            autoReleaseAt: null,
          }),
        }),
      );
    });

    it('should throw ConflictException if revision limit has been reached', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customerId: 'cust-1',
        status: OrderStatus.DELIVERED,
        maxRevisions: 1,
        usedRevisions: 1,
      });

      await expect(
        service.requestRevision('cust-1', 'ord-1', {
          revisionNotes: 'Another revision please',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('requestWithdrawal', () => {
    it('should deduct wallet balance and log withdrawal transaction', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'usr-vendor',
        wallet: {
          id: 'w-1',
          balance: 1500,
          totalWithdrawn: 200,
        },
      });
      (prisma.vendorWallet as any).update = vi.fn().mockResolvedValue({
        id: 'w-1',
        balance: 1000,
        totalWithdrawn: 700,
      });

      const res = await service.requestWithdrawal('usr-vendor', {
        amount: 500,
        payoutMethod: 'BKASH' as any,
        payoutAccount: '01712345678',
      });

      expect(res.wallet.balance).toBe(1000);
      expect((prisma.vendorWallet as any).update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'w-1' },
          data: {
            balance: { decrement: 500 },
            totalWithdrawn: { increment: 500 },
          },
        }),
      );
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: -500,
            type: 'WITHDRAWAL',
            payoutMethod: 'BKASH',
          }),
        }),
      );
    });

    it('should reject withdrawal when balance is insufficient', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'usr-vendor',
        wallet: {
          id: 'w-1',
          balance: 300,
        },
      });

      await expect(
        service.requestWithdrawal('usr-vendor', {
          amount: 500,
          payoutMethod: 'NAGAD' as any,
          payoutAccount: '01812345678',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});

