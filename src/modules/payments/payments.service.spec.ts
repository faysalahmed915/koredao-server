import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PaymentGateway } from './dto/initiate-payment.dto.js';
import { OrderStatus } from '@prisma/client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    order: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    subscription: {
      findMany: ReturnType<typeof vi.fn>;
    };
    walletTransaction: {
      findMany: ReturnType<typeof vi.fn>;
    };
    escrowHolding: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let config: {
    get: ReturnType<typeof vi.fn>;
  };
  let ordersService: {
    fundEscrow: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      subscription: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      walletTransaction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      escrowHolding: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    config = {
      get: vi.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'payment.returnUrl') return 'http://localhost:3001/orders';
        if (key === 'payment.aamarpay.storeId') return 'aamarpaytest';
        if (key === 'payment.aamarpay.signatureKey') return 'dbb74894e82415a2f7ff0ec3a97e4183';
        if (key === 'payment.aamarpay.isSandbox') return true;
        if (key === 'payment.piprapay.apiKey') return 'demo_key';
        if (key === 'payment.piprapay.isSandbox') return true;
        if (key === 'app.port') return 3000;
        return defaultValue;
      }),
    };

    ordersService = {
      fundEscrow: vi.fn().mockResolvedValue({ id: 'ord-1', status: OrderStatus.ESCROW_HELD }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('initiatePayment', () => {
    it('should generate simulated checkout URL in MOCK_SANDBOX mode', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        orderNumber: 'KD-202610-001',
        customerId: 'cust-1',
        status: OrderStatus.PENDING_PAYMENT,
        totalAmount: 1500,
        title: 'Calculus Assignment Part 2',
        customer: { id: 'cust-1', name: 'Rahim Khan', email: 'rahim@test.com' },
        vendorProfile: { id: 'vp-1', userId: 'vend-1' },
      });

      const res = await service.initiatePayment('cust-1', {
        orderId: 'ord-1',
        gateway: PaymentGateway.MOCK_SANDBOX,
        clientReturnUrl: 'http://localhost:3001/orders/ord-1',
      });

      expect(res.gateway).toBe(PaymentGateway.MOCK_SANDBOX);
      expect(res.paymentUrl).toContain('sandboxModal=true');
      expect(res.paymentUrl).toContain('orderId=ord-1');
      expect(res.amount).toBe(1500);
      expect(res.transactionId).toBeDefined();
    });

    it('should throw ForbiddenException if order does not belong to caller', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customerId: 'cust-another',
        status: OrderStatus.PENDING_PAYMENT,
      });

      await expect(
        service.initiatePayment('cust-intruder', {
          orderId: 'ord-1',
          gateway: PaymentGateway.MOCK_SANDBOX,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if order is already funded or completed', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customerId: 'cust-1',
        status: OrderStatus.ESCROW_HELD,
      });

      await expect(
        service.initiatePayment('cust-1', {
          orderId: 'ord-1',
          gateway: PaymentGateway.MOCK_SANDBOX,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('handleAamarpayCallback', () => {
    it('should trigger fundEscrow upon successful Aamarpay callback and redirect', async () => {
      const callbackData = {
        pay_status: 'Successful',
        pg_txnid: 'AAMAR_TEST_882194',
        mer_txnid: 'KD_AAMAR_123',
        amount: '1500',
      };

      const redirectUrl = await service.handleAamarpayCallback(
        callbackData,
        'ord-1',
        'http://localhost:3001/orders/ord-1',
      );

      expect(ordersService.fundEscrow).toHaveBeenCalledWith(
        'ord-1',
        'AAMARPAY',
        'AAMAR_TEST_882194',
      );
      expect(redirectUrl).toContain('payment=success');
      expect(redirectUrl).toContain('gateway=AAMARPAY');
    });

    it('should not fund escrow if payment was failed or cancelled', async () => {
      const callbackData = {
        pay_status: 'Failed',
        pg_txnid: 'AAMAR_FAIL_001',
      };

      const redirectUrl = await service.handleAamarpayCallback(
        callbackData,
        'ord-1',
        'http://localhost:3001/orders/ord-1',
      );

      expect(ordersService.fundEscrow).not.toHaveBeenCalled();
      expect(redirectUrl).toContain('payment=failed');
    });
  });

  describe('handlePiprapayIpn', () => {
    it('should trigger fundEscrow upon successful PipraPay IPN', async () => {
      const ipnData = {
        status: 'COMPLETED',
        pp_txnid: 'PIPRA_TRX_77123',
        amount: 1500,
      };

      const redirectUrl = await service.handlePiprapayIpn(
        ipnData,
        'ord-1',
        'http://localhost:3001/orders/ord-1',
      );

      expect(ordersService.fundEscrow).toHaveBeenCalledWith(
        'ord-1',
        'PIPRAPAY',
        'PIPRA_TRX_77123',
      );
      expect(redirectUrl).toContain('payment=success');
    });
  });

  describe('verifyPayment', () => {
    it('should return funded: true if order status is already ESCROW_HELD', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        customerId: 'cust-1',
        status: OrderStatus.ESCROW_HELD,
        escrowHolding: { status: 'HELD', amount: 1500 },
      });

      const res = await service.verifyPayment('cust-1', { orderId: 'ord-1' });
      expect(res.funded).toBe(true);
      expect(res.status).toBe(OrderStatus.ESCROW_HELD);
    });

    it('should fund escrow if transactionRef is passed for a pending order', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce({
          id: 'ord-1',
          customerId: 'cust-1',
          status: OrderStatus.PENDING_PAYMENT,
          escrowHolding: { status: 'AWAITING_PAYMENT', amount: 1500 },
        })
        .mockResolvedValueOnce({
          id: 'ord-1',
          customerId: 'cust-1',
          status: OrderStatus.ESCROW_HELD,
          escrowHolding: { status: 'HELD', amount: 1500 },
        });

      const res = await service.verifyPayment('cust-1', {
        orderId: 'ord-1',
        transactionRef: 'VERIFIED_SANDBOX_TXN',
      });

      expect(ordersService.fundEscrow).toHaveBeenCalledWith(
        'ord-1',
        'VERIFIED_GATEWAY',
        'VERIFIED_SANDBOX_TXN',
      );
      expect(res.funded).toBe(true);
    });
  });

  describe('getPaymentHistory', () => {
    it('should return empty ledger for a customer with no orders', async () => {
      const res = await service.getPaymentHistory('cust-empty');

      expect(res.summary.totalSpent).toBe(0);
      expect(res.summary.inEscrow).toBe(0);
      expect(res.entries).toEqual([]);
      expect(res.orders).toEqual([]);
    });

    it('should build escrow deposit/release entries and summary totals', async () => {
      const fundedAt = new Date('2026-01-10T10:00:00Z');
      const releasedAt = new Date('2026-01-15T10:00:00Z');
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          orderNumber: 'KD-001',
          title: 'Calculus Assignment',
          totalAmount: 1500,
          platformFee: 150,
          status: OrderStatus.COMPLETED,
          deadline: new Date('2026-01-20T00:00:00Z'),
          createdAt: new Date('2026-01-05T00:00:00Z'),
          escrowHolding: {
            amount: 1500,
            status: 'RELEASED_TO_VENDOR',
            paymentGateway: 'AAMARPAY',
            transactionRef: 'AAMAR_TRX_1',
            fundedAt,
            releasedAt,
            refundedAt: null,
          },
          vendorProfile: { user: { name: 'Tanvir', image: null } },
        },
      ]);

      const res = await service.getPaymentHistory('cust-1');

      expect(res.summary.totalSpent).toBe(1500);
      expect(res.summary.inEscrow).toBe(0);
      expect(res.summary.ordersCount).toBe(1);
      // deposit + release entries
      expect(res.entries).toHaveLength(2);
      expect(res.entries.map((e: any) => e.type).sort()).toEqual([
        'ESCROW_DEPOSIT',
        'ESCROW_RELEASE',
      ]);
      // Entries are sorted newest-first, so the release comes before the deposit.
      expect(res.entries[0].type).toBe('ESCROW_RELEASE');
      expect(res.entries[0].vendorName).toBe('Tanvir');
      expect(res.orders[0].escrowStatus).toBe('RELEASED_TO_VENDOR');
    });

    it('should count in-flight escrow as inEscrow and include refunded totals', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-held',
          orderNumber: 'KD-002',
          title: 'Thesis Chapter',
          totalAmount: 3000,
          platformFee: 300,
          status: OrderStatus.IN_PROGRESS,
          deadline: new Date('2026-02-01T00:00:00Z'),
          createdAt: new Date('2026-01-06T00:00:00Z'),
          escrowHolding: {
            amount: 3000,
            status: 'HELD',
            paymentGateway: 'PIPRAPAY',
            transactionRef: 'PIPRA_TRX_9',
            fundedAt: new Date('2026-01-07T00:00:00Z'),
            releasedAt: null,
            refundedAt: null,
          },
          vendorProfile: { user: { name: 'Fahim', image: null } },
        },
        {
          id: 'ord-refunded',
          orderNumber: 'KD-003',
          title: 'Lab Report',
          totalAmount: 800,
          platformFee: 80,
          status: OrderStatus.REFUNDED,
          deadline: new Date('2026-01-30T00:00:00Z'),
          createdAt: new Date('2026-01-04T00:00:00Z'),
          escrowHolding: {
            amount: 800,
            status: 'REFUNDED_TO_CUSTOMER',
            paymentGateway: 'MOCK_SANDBOX',
            transactionRef: null,
            fundedAt: new Date('2026-01-05T00:00:00Z'),
            releasedAt: null,
            refundedAt: new Date('2026-01-08T00:00:00Z'),
          },
          vendorProfile: { user: { name: 'Samira', image: null } },
        },
      ]);
      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          plan: 'MEMBER_MONTHLY',
          status: 'ACTIVE',
          amount: 19900,
          paymentGateway: 'sandbox',
          paymentReference: 'SUB_TRX_1',
          merchantReference: 'KD_SUB_1',
          startedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);

      const res = await service.getPaymentHistory('cust-2');

      expect(res.summary.inEscrow).toBe(3000);
      expect(res.summary.totalRefunded).toBe(800);
      expect(res.summary.subscriptionSpend).toBe(199);
      const subEntry = res.entries.find((e: any) => e.type === 'SUBSCRIPTION');
      expect(subEntry).toBeDefined();
      expect(subEntry?.amount).toBe(199);
    });
  });

  describe('getPlatformLedger', () => {
    it('should aggregate escrow, revenue, GMV and withdrawal totals', async () => {
      prisma.walletTransaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          amount: 1350,
          type: 'ESCROW_RELEASE',
          description: 'Escrow release for KD-001',
          payoutMethod: null,
          payoutAccount: null,
          createdAt: new Date('2026-01-15T10:00:00Z'),
          wallet: {
            vendorProfile: {
              university: 'BUET',
              user: { name: 'Tanvir', email: 'tanvir@koredao.com' },
            },
          },
        },
        {
          id: 'tx-2',
          amount: -500,
          type: 'WITHDRAWAL',
          description: 'Withdrawal via BKASH to 01700000000',
          payoutMethod: 'BKASH',
          payoutAccount: '01700000000',
          createdAt: new Date('2026-01-16T10:00:00Z'),
          wallet: {
            vendorProfile: {
              university: 'DU',
              user: { name: 'Fahim', email: 'fahim@koredao.com' },
            },
          },
        },
      ]);
      prisma.escrowHolding.findMany
        .mockResolvedValueOnce([{ amount: 2000 }]) // HELD query
        .mockResolvedValueOnce([
          {
            id: 'esc-1',
            amount: 1500,
            status: 'RELEASED_TO_VENDOR',
            paymentGateway: 'AAMARPAY',
            releasedAt: new Date('2026-01-15T10:00:00Z'),
            refundedAt: null,
            updatedAt: new Date('2026-01-15T10:00:00Z'),
            order: {
              orderNumber: 'KD-001',
              title: 'Calculus Assignment',
              platformFee: 150,
              totalAmount: 1500,
              customer: { name: 'Lamia' },
            },
          },
        ]);
      prisma.order.findMany.mockResolvedValue([
        { totalAmount: 5000, platformFee: 500 },
        { totalAmount: 2500, platformFee: 250 },
      ]);

      const res = await service.getPlatformLedger();

      expect(res.summary.totalEscrowHeld).toBe(2000);
      expect(res.summary.escrowHeldCount).toBe(1);
      expect(res.summary.totalPlatformRevenue).toBe(750);
      expect(res.summary.totalGMV).toBe(7500);
      expect(res.summary.totalWithdrawn).toBe(500);
      expect(res.summary.completedOrdersCount).toBe(2);
      expect(res.transactions).toHaveLength(2);
      expect(res.transactions[0].vendorName).toBe('Tanvir');
      expect(res.escrowMovements).toHaveLength(1);
      expect(res.escrowMovements[0].customerName).toBe('Lamia');
    });

    it('should return zeroed totals when the platform has no activity', async () => {
      const res = await service.getPlatformLedger();

      expect(res.summary.totalEscrowHeld).toBe(0);
      expect(res.summary.totalPlatformRevenue).toBe(0);
      expect(res.summary.totalGMV).toBe(0);
      expect(res.summary.totalWithdrawn).toBe(0);
      expect(res.transactions).toEqual([]);
      expect(res.escrowMovements).toEqual([]);
    });
  });
});

