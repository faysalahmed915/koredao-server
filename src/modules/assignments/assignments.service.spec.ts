import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssignmentsService } from './assignments.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AssignmentStatus, AssignmentType, BidStatus, GigCategory, VerificationStatus } from '@prisma/client';

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
        count: vi.fn(),
      },
      bid: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      vendorProfile: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
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
    it('should accept chosen bid, reject other bids, and transition assignment to ASSIGNED', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'asg-1',
        customerId: 'cust-1',
        status: AssignmentStatus.OPEN,
      });
      prisma.bid.findUnique.mockResolvedValue({
        id: 'bid-1',
        assignmentId: 'asg-1',
        status: BidStatus.PENDING,
      });

      const mockUpdatedAssignment = { id: 'asg-1', status: AssignmentStatus.ASSIGNED };
      const mockAcceptedBid = { id: 'bid-1', status: BidStatus.ACCEPTED };

      prisma.assignment.update.mockResolvedValue(mockUpdatedAssignment);
      prisma.bid.update.mockResolvedValue(mockAcceptedBid);
      prisma.bid.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.acceptBid('cust-1', 'asg-1', 'bid-1');

      expect(result.assignment).toEqual(mockUpdatedAssignment);
      expect(result.acceptedBid).toEqual(mockAcceptedBid);
      expect(prisma.$transaction).toHaveBeenCalled();
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
  });
});
