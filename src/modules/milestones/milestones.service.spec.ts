import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MilestonesService } from './milestones.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { CheckpointReviewDecision } from './dto/review-checkpoint.dto.js';
import { CheckpointStatus, OrderStatus } from '@prisma/client';

describe('MilestonesService', () => {
  let service: MilestonesService;
  let prisma: {
    order: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    projectCheckpoint: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: vi.fn(),
      },
      projectCheckpoint: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestonesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MilestonesService>(MilestonesService);
  });

  describe('createCheckpoint', () => {
    it('should create a milestone checkpoint when caller is the assigned helper and order is active', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: OrderStatus.ESCROW_HELD,
        vendorProfile: { userId: 'vend-1' },
      });

      prisma.projectCheckpoint.create.mockResolvedValue({
        id: 'cp-1',
        orderId: 'ord-1',
        title: 'Outline & References',
        status: CheckpointStatus.PENDING,
      });

      const res = await service.createCheckpoint('vend-1', {
        orderId: 'ord-1',
        title: 'Outline & References',
      });

      expect(res.id).toBe('cp-1');
      expect(prisma.projectCheckpoint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'ord-1',
            title: 'Outline & References',
            status: CheckpointStatus.PENDING,
          }),
        }),
      );
    });

    it('should throw ForbiddenException if user is not the assigned helper', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: OrderStatus.ESCROW_HELD,
        vendorProfile: { userId: 'vend-1' },
      });

      await expect(
        service.createCheckpoint('other-user', {
          orderId: 'ord-1',
          title: 'Draft',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if order is not in active status', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        status: OrderStatus.PENDING_PAYMENT,
        vendorProfile: { userId: 'vend-1' },
      });

      await expect(
        service.createCheckpoint('vend-1', {
          orderId: 'ord-1',
          title: 'Draft',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('submitProgress', () => {
    it('should update checkpoint status to SUBMITTED with proof photos and courier details', async () => {
      prisma.projectCheckpoint.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: CheckpointStatus.PENDING,
        order: {
          status: OrderStatus.IN_PROGRESS,
          vendorProfile: { userId: 'vend-1' },
        },
      });

      prisma.projectCheckpoint.update.mockResolvedValue({
        id: 'cp-1',
        status: CheckpointStatus.SUBMITTED,
        proofPhotoUrls: ['https://example.com/handwriting-sample.jpg'],
        courierTracking: 'Pathao: PT-9921',
      });

      const res = await service.submitProgress('vend-1', 'cp-1', {
        proofPhotoUrls: ['https://example.com/handwriting-sample.jpg'],
        courierTracking: 'Pathao: PT-9921',
        vendorNotes: 'Here is the sample handwritten cover page and math proofs.',
      });

      expect(res.status).toBe(CheckpointStatus.SUBMITTED);
      expect(prisma.projectCheckpoint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cp-1' },
          data: expect.objectContaining({
            status: CheckpointStatus.SUBMITTED,
            courierTracking: 'Pathao: PT-9921',
          }),
        }),
      );
    });
  });

  describe('reviewCheckpoint', () => {
    it('should allow customer to accept a submitted checkpoint', async () => {
      prisma.projectCheckpoint.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: CheckpointStatus.SUBMITTED,
        order: {
          customerId: 'cust-1',
        },
      });

      prisma.projectCheckpoint.update.mockResolvedValue({
        id: 'cp-1',
        status: CheckpointStatus.ACCEPTED,
        clientFeedback: 'Approved! Great handwriting style.',
      });

      const res = await service.reviewCheckpoint('cust-1', 'cp-1', {
        status: CheckpointReviewDecision.ACCEPTED,
        clientFeedback: 'Approved! Great handwriting style.',
      });

      expect(res.status).toBe(CheckpointStatus.ACCEPTED);
      expect(prisma.projectCheckpoint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CheckpointStatus.ACCEPTED,
          }),
        }),
      );
    });

    it('should allow customer to request revision on checkpoint', async () => {
      prisma.projectCheckpoint.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: CheckpointStatus.SUBMITTED,
        order: {
          customerId: 'cust-1',
        },
      });

      prisma.projectCheckpoint.update.mockResolvedValue({
        id: 'cp-1',
        status: CheckpointStatus.REVISION_REQUESTED,
        clientFeedback: 'Please write with blue ink instead of black.',
      });

      const res = await service.reviewCheckpoint('cust-1', 'cp-1', {
        status: CheckpointReviewDecision.REVISION_REQUESTED,
        clientFeedback: 'Please write with blue ink instead of black.',
      });

      expect(res.status).toBe(CheckpointStatus.REVISION_REQUESTED);
    });

    it('should throw ForbiddenException if reviewer is not the customer', async () => {
      prisma.projectCheckpoint.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: CheckpointStatus.SUBMITTED,
        order: {
          customerId: 'cust-1',
        },
      });

      await expect(
        service.reviewCheckpoint('stranger', 'cp-1', {
          status: CheckpointReviewDecision.ACCEPTED,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteCheckpoint', () => {
    it('should delete a pending checkpoint', async () => {
      prisma.projectCheckpoint.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: CheckpointStatus.PENDING,
        order: {
          vendorProfile: { userId: 'vend-1' },
        },
      });
      prisma.projectCheckpoint.delete.mockResolvedValue({});

      const res = await service.deleteCheckpoint('vend-1', 'cp-1');
      expect(res.success).toBe(true);
      expect(prisma.projectCheckpoint.delete).toHaveBeenCalledWith({
        where: { id: 'cp-1' },
      });
    });

    it('should prevent deletion of an already accepted milestone', async () => {
      prisma.projectCheckpoint.findUnique.mockResolvedValue({
        id: 'cp-1',
        status: CheckpointStatus.ACCEPTED,
        order: {
          vendorProfile: { userId: 'vend-1' },
        },
      });

      await expect(
        service.deleteCheckpoint('vend-1', 'cp-1'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
