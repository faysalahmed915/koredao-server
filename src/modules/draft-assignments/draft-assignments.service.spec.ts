import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DraftAssignmentsService } from './draft-assignments.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import {
  DraftStatus,
  AssignmentStatus,
  GigCategory,
  AssignmentType,
  HandwritingStyle,
} from '@prisma/client';

describe('DraftAssignmentsService', () => {
  let service: DraftAssignmentsService;
  let prisma: {
    draftAssignment: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    assignment: {
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      draftAssignment: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      assignment: {
        create: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (arg: any) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return arg(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftAssignmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DraftAssignmentsService>(DraftAssignmentsService);
  });

  describe('listMyDrafts', () => {
    it('should return drafts owned by the user, newest first', async () => {
      const mockDrafts = [
        { id: 'draft-1', userId: 'user-1', updatedAt: new Date() },
      ];
      prisma.draftAssignment.findMany.mockResolvedValue(mockDrafts);

      const result = await service.listMyDrafts('user-1');

      expect(result).toEqual(mockDrafts);
      expect(prisma.draftAssignment.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('getDraft', () => {
    it('should return the draft if owned by the user', async () => {
      const mockDraft = {
        id: 'draft-1',
        userId: 'user-1',
        title: 'Physics Lab',
        status: DraftStatus.DRAFT,
      };
      prisma.draftAssignment.findUnique.mockResolvedValue(mockDraft);

      const result = await service.getDraft('user-1', 'draft-1');

      expect(result).toEqual(mockDraft);
      expect(prisma.draftAssignment.findUnique).toHaveBeenCalledWith({
        where: { id: 'draft-1' },
      });
    });

    it('should throw NotFoundException if draft does not exist', async () => {
      prisma.draftAssignment.findUnique.mockResolvedValue(null);

      await expect(service.getDraft('user-1', 'draft-99')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if the user does not own the draft', async () => {
      prisma.draftAssignment.findUnique.mockResolvedValue({
        id: 'draft-1',
        userId: 'other-user',
      });

      await expect(service.getDraft('user-1', 'draft-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('createDraft', () => {
    const validDto = {
      title: 'Physics Lab',
      description: 'Young modulus calculations',
      category: GigCategory.LAB_REPORT,
      subject: 'Physics',
      type: AssignmentType.SOFTCOPY,
      deadline: '2026-10-20T00:00:00.000Z',
      budgetMin: 500,
      budgetMax: 1000,
      sampleFileUrls: [],
    };

    it('should create a draft with DRAFT status', async () => {
      const mockCreated = {
        id: 'draft-1',
        userId: 'user-1',
        ...validDto,
        status: DraftStatus.DRAFT,
      };
      prisma.draftAssignment.create.mockResolvedValue(mockCreated);

      const result = await service.createDraft('user-1', validDto as any);

      expect(result).toEqual(mockCreated);
      expect(prisma.draftAssignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          status: DraftStatus.DRAFT,
        }),
      });
    });

    it('should throw ConflictException if min budget exceeds max budget', async () => {
      await expect(
        service.createDraft('user-1', {
          ...validDto,
          budgetMin: 1000,
          budgetMax: 500,
        } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateDraft', () => {
    it('should update the draft if owned by the user', async () => {
      const existing = { id: 'draft-1', userId: 'user-1', title: 'Old Title' };
      prisma.draftAssignment.findUnique.mockResolvedValue(existing);
      prisma.draftAssignment.update.mockResolvedValue({
        ...existing,
        title: 'New Title',
      });

      const result = await service.updateDraft('user-1', 'draft-1', {
        title: 'New Title',
      } as any);

      expect(result.title).toBe('New Title');
      expect(prisma.draftAssignment.update).toHaveBeenCalledWith({
        where: { id: 'draft-1' },
        data: expect.objectContaining({ title: 'New Title' }),
      });
    });

    it('should throw ForbiddenException if the user does not own the draft', async () => {
      prisma.draftAssignment.findUnique.mockResolvedValue({
        id: 'draft-1',
        userId: 'other-user',
      });

      await expect(
        service.updateDraft('user-1', 'draft-1', { title: 'New' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteDraft', () => {
    it('should delete the draft if owned by the user', async () => {
      const existing = { id: 'draft-1', userId: 'user-1' };
      prisma.draftAssignment.findUnique.mockResolvedValue(existing);
      prisma.draftAssignment.delete.mockResolvedValue(existing);

      const result = await service.deleteDraft('user-1', 'draft-1');

      expect(result).toEqual({ id: 'draft-1', deleted: true });
      expect(prisma.draftAssignment.delete).toHaveBeenCalledWith({
        where: { id: 'draft-1' },
      });
    });

    it('should throw ForbiddenException if the user does not own the draft', async () => {
      prisma.draftAssignment.findUnique.mockResolvedValue({
        id: 'draft-1',
        userId: 'other-user',
      });

      await expect(service.deleteDraft('user-1', 'draft-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('publishDraft', () => {
    const existingDraft = {
      id: 'draft-1',
      userId: 'user-1',
      title: 'Draft Title',
      description: 'Draft Description',
      category: GigCategory.LAB_REPORT,
      subject: 'Physics',
      type: AssignmentType.SOFTCOPY,
      deadline: new Date('2026-10-20'),
      budgetMin: 500,
      budgetMax: 1000,
      deliveryAddress: null,
      preferredCampus: null,
      preferredHandwritingStyle: null,
      sampleFileUrls: [],
      status: DraftStatus.DRAFT,
    };

    it('should publish the draft as an assignment and archive it', async () => {
      prisma.draftAssignment.findUnique.mockResolvedValue(existingDraft);
      const mockAssignment = { id: 'asg-1', customerId: 'user-1', title: 'Draft Title' };
      prisma.assignment.create.mockResolvedValue(mockAssignment);
      prisma.draftAssignment.update.mockResolvedValue({
        ...existingDraft,
        status: DraftStatus.PUBLISHED,
      });

      const result = await service.publishDraft('user-1', 'draft-1', {} as any);

      expect(result.assignment).toEqual(mockAssignment);
      expect(result.draftId).toBe('draft-1');
      expect(prisma.assignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'user-1',
          status: AssignmentStatus.OPEN,
        }),
      });
      expect(prisma.draftAssignment.update).toHaveBeenCalledWith({
        where: { id: 'draft-1' },
        data: { status: DraftStatus.PUBLISHED },
      });
    });

    it('should throw ConflictException if draft is not in DRAFT status', async () => {
      prisma.draftAssignment.findUnique.mockResolvedValue({
        ...existingDraft,
        status: DraftStatus.PUBLISHED,
      });

      await expect(
        service.publishDraft('user-1', 'draft-1', {} as any),
      ).rejects.toThrow(ConflictException);
    });
  });

});
