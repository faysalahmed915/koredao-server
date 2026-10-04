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
});
