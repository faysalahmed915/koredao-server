import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssignmentsService } from './assignments.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AssignmentStatus, AssignmentType, BidStatus, GigCategory, OrderStatus, EscrowStatus, VerificationStatus } from '@prisma/client';

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  let prisma: {
    assignment: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    bid: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    order: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    escrowHolding: {
      create: ReturnType<typeof vi.fn>;
    };
    vendorProfile: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      assignment: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      bid: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      order: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      escrowHolding: {
        create: vi.fn(),
      },
      vendorProfile: {
        findUnique: vi.fn(),
      },
      // Supports both the array form ($transaction([...])) and the deferred
      // callback form ($transaction(async (tx) => {...})).
      $transaction: vi.fn().mockImplementation(async (arg: any) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return arg(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  describe('create', () => {
    it('should create an open assignment post', async () => {
      const mockCreated = {
        id: 'asg-1',
        title: 'Physics Lab',
        status: AssignmentStatus.OPEN,
      };
      prisma.assignment.create.mockResolvedValue(mockCreated);

      const result = await service.create('cust-1', {
        title: 'Physics Lab',
        description: 'Young modulus error calculations',
        category: GigCategory.LAB_REPORT,
        subject: 'Physics',
        type: AssignmentType.SOFTCOPY,
        deadline: '2026-10-20T00:00:00.000Z',
        budgetMin: 500,
        budgetMax: 1000,
      });

      expect(result).toEqual(mockCreated);
      expect(prisma.assignment.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if budgetMin exceeds budgetMax', async () => {
      await expect(
        service.create('cust-1', {
          title: 'Physics Lab',
          description: 'Young modulus error calculations',
          category: GigCategory.LAB_REPORT,
          subject: 'Physics',
          type: AssignmentType.SOFTCOPY,
          deadline: '2026-10-20T00:00:00.000Z',
          budgetMin: 1200,
          budgetMax: 500,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when the weekly posting limit (5) is reached', async () => {
      prisma.assignment.count.mockImplementation((args: any) => {
        // weekly window count (createdAt filter) returns 5; active count returns 0
        if (args?.where?.createdAt) return Promise.resolve(5);
        return Promise.resolve(0);
      });

      await expect(
        service.create('cust-1', {
          title: 'Physics Lab',
          description: 'Young modulus error calculations',
          category: GigCategory.LAB_REPORT,
          subject: 'Physics',
          type: AssignmentType.SOFTCOPY,
          deadline: '2026-10-20T00:00:00.000Z',
          budgetMin: 500,
          budgetMax: 1000,
        }),
      ).rejects.toThrow(/Weekly job posting limit/i);

      expect(prisma.assignment.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when 3 active jobs already exist', async () => {
      prisma.assignment.count.mockImplementation((args: any) => {
        if (args?.where?.createdAt) return Promise.resolve(1);
        // active status count returns 3
        return Promise.resolve(3);
      });

      await expect(
        service.create('cust-1', {
          title: 'Physics Lab',
          description: 'Young modulus error calculations',
          category: GigCategory.LAB_REPORT,
          subject: 'Physics',
          type: AssignmentType.SOFTCOPY,
          deadline: '2026-10-20T00:00:00.000Z',
          budgetMin: 500,
          budgetMax: 1000,
        }),
      ).rejects.toThrow(/active jobs with helpers/i);

      expect(prisma.assignment.create).not.toHaveBeenCalled();
    });
  });

  describe('submitBid', () => {
    it('should submit a bid and increment assignment bidsCount', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'vendor-1',
        verificationStatus: VerificationStatus.APPROVED,
      });
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'asg-1',
        customerId: 'cust-1',
        status: AssignmentStatus.OPEN,
      });

      const mockBid = {
        id: 'bid-1',
        proposedPrice: 800,
        deliveryDays: 2,
        status: BidStatus.PENDING,
      };
      prisma.bid.create.mockResolvedValue(mockBid);
      prisma.assignment.update.mockResolvedValue({});

      const result = await service.submitBid('vendor-1', 'asg-1', {
        proposedPrice: 800,
        deliveryDays: 2,
        coverLetter: 'I am experienced in this exact topic and can provide top grade work.',
      });

      expect(result).toEqual(mockBid);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw ConflictException if user tries to bid on their own assignment', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'cust-1',
        verificationStatus: VerificationStatus.APPROVED,
      });
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'asg-1',
        customerId: 'cust-1',
        status: AssignmentStatus.OPEN,
      });

      await expect(
        service.submitBid('cust-1', 'asg-1', {
          proposedPrice: 500,
          deliveryDays: 2,
          coverLetter: 'My own proposal',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('acceptBid', () => {
    it('should accept chosen bid, reject other bids, create order + escrow atomically, and transition assignment to ASSIGNED', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'asg-1',
        customerId: 'cust-1',
        status: AssignmentStatus.OPEN,
      });
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.bid.findUnique.mockResolvedValue({
        id: 'bid-1',
        assignmentId: 'asg-1',
        status: BidStatus.PENDING,
        vendorProfileId: 'vp-1',
        proposedPrice: 800,
        deliveryDays: 2,
      });

      const mockUpdatedAssignment = { id: 'asg-1', status: AssignmentStatus.ASSIGNED, acceptedBidId: 'bid-1' };
      const mockAcceptedBid = { id: 'bid-1', status: BidStatus.ACCEPTED, assignmentId: 'asg-1' };
      const mockOrder = { id: 'ord-1', orderNumber: 'ORD-12345678-ABCD', status: OrderStatus.PENDING_PAYMENT };

      prisma.assignment.update.mockResolvedValue(mockUpdatedAssignment);
      prisma.bid.update.mockResolvedValue(mockAcceptedBid);
      prisma.bid.updateMany.mockResolvedValue({ count: 2 });
      prisma.order.create.mockResolvedValue(mockOrder);
      prisma.escrowHolding.create.mockResolvedValue({ id: 'eh-1', orderId: 'ord-1', status: EscrowStatus.AWAITING_PAYMENT });

      const result = await service.acceptBid('cust-1', 'asg-1', 'bid-1');

      expect(result.assignment).toEqual(mockUpdatedAssignment);
      expect(result.acceptedBid).toEqual(mockAcceptedBid);
      expect(result.order).toEqual(mockOrder);
      expect(result.idempotent).toBe(false);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txArg = prisma.$transaction.mock.calls[0][0];
      expect(typeof txArg).toBe('function');
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignmentId: 'asg-1',
            bidId: 'bid-1',
            customerId: 'cust-1',
            status: OrderStatus.PENDING_PAYMENT,
          }),
        }),
      );
      expect(prisma.escrowHolding.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: EscrowStatus.AWAITING_PAYMENT }),
        }),
      );
    });

    it('should be idempotent: return existing order without mutation on repeated acceptance', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'asg-1',
        customerId: 'cust-1',
        status: AssignmentStatus.ASSIGNED,
      });
      const existingOrder = {
        id: 'ord-1',
        orderNumber: 'ORD-12345678-ABCD',
        status: OrderStatus.ESCROW_HELD,
        customerId: 'cust-1',
        vendorProfileId: 'vp-1',
        totalAmount: 800,
        escrowHolding: { id: 'eh-1', status: EscrowStatus.HELD },
      };
      prisma.order.findFirst.mockResolvedValue(existingOrder);

      const result = await service.acceptBid('cust-1', 'asg-1', 'bid-1');

      expect(result.idempotent).toBe(true);
      expect(result.order).toEqual(existingOrder);
      expect(result.assignment).toMatchObject({ id: 'asg-1', status: AssignmentStatus.ASSIGNED });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.assignment.update).not.toHaveBeenCalled();
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if caller is not the assignment owner', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'asg-1',
        customerId: 'owner-user',
        status: AssignmentStatus.OPEN,
      });

      await expect(service.acceptBid('intruder-user', 'asg-1', 'bid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if assignment is not OPEN', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'asg-1',
        customerId: 'cust-1',
        status: AssignmentStatus.ASSIGNED,
      });

      await expect(service.acceptBid('cust-1', 'asg-1', 'bid-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if bid is not PENDING', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'asg-1',
        customerId: 'cust-1',
        status: AssignmentStatus.OPEN,
      });
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.bid.findUnique.mockResolvedValue({
        id: 'bid-1',
        assignmentId: 'asg-1',
        status: BidStatus.ACCEPTED,
      });

      await expect(service.acceptBid('cust-1', 'asg-1', 'bid-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if bid does not belong to assignment', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'asg-1',
        customerId: 'cust-1',
        status: AssignmentStatus.OPEN,
      });
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.bid.findUnique.mockResolvedValue({
        id: 'bid-1',
        assignmentId: 'other-asg',
        status: BidStatus.PENDING,
      });

      await expect(service.acceptBid('cust-1', 'asg-1', 'bid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});



