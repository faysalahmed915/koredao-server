import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GigsService } from './gigs.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { GigCategory, GigTierType, HandwritingStyle, VerificationStatus } from '@prisma/client';

describe('GigsService', () => {
  let service: GigsService;
  let prisma: {
    vendorProfile: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    gig: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      vendorProfile: {
        findUnique: vi.fn(),
      },
      gig: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GigsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<GigsService>(GigsService);
  });

  describe('create', () => {
    it('should create a gig with calculated priceFrom and deliveryDays for approved helper', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'u-1',
        verificationStatus: VerificationStatus.APPROVED,
      });

      const mockGig = {
        id: 'gig-1',
        title: 'Calculus Solutions',
        slug: 'calculus-solutions-abc123',
        priceFrom: 500,
        deliveryDays: 2,
      };
      prisma.gig.create.mockResolvedValue(mockGig);

      const result = await service.create('u-1', {
        title: 'Calculus Solutions',
        description: 'Complete calculus assignment solutions with step-by-step proofs.',
        category: GigCategory.MATH_PROBLEM_SOLVING,
        tierType: GigTierType.SINGLE,
        packages: [
          { name: 'Standard', price: 500, deliveryDays: 2 },
          { name: 'Express', price: 900, deliveryDays: 1 },
        ],
      });

      expect(result).toEqual(mockGig);
      expect(prisma.gig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priceFrom: 500,
            deliveryDays: 1,
          }),
        }),
      );
    });

    it('should throw ForbiddenException if vendor is not approved yet', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'u-1',
        verificationStatus: VerificationStatus.PENDING,
      });

      await expect(
        service.create('u-1', {
          title: 'Physics Lab',
          description: 'Physics lab notes.',
          category: GigCategory.LAB_REPORT,
          tierType: GigTierType.SINGLE,
          packages: [{ name: 'Basic', price: 400, deliveryDays: 3 }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update & remove', () => {
    it('should deny updating a gig owned by another vendor', async () => {
      prisma.gig.findUnique.mockResolvedValue({
        id: 'gig-1',
        vendorProfile: { userId: 'other-user' },
      });

      await expect(
        service.update('u-1', 'gig-1', {
          title: 'Updated Title',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to delete a gig', async () => {
      prisma.gig.findUnique.mockResolvedValue({
        id: 'gig-1',
        title: 'My Gig',
        vendorProfile: { userId: 'u-1' },
      });
      prisma.gig.delete.mockResolvedValue({ id: 'gig-1' });

      const result = await service.remove('u-1', 'gig-1');
      expect(result.success).toBe(true);
      expect(prisma.gig.delete).toHaveBeenCalledWith({ where: { id: 'gig-1' } });
    });
  });

  describe('search', () => {
    it('should return paginated active gigs matching filters', async () => {
      const mockGigs = [{ id: 'gig-1', title: 'Organic Chemistry Lab' }];
      prisma.gig.findMany.mockResolvedValue(mockGigs);
      prisma.gig.count.mockResolvedValue(1);

      const result = await service.search({
        category: GigCategory.LAB_REPORT,
        subject: 'Organic Chemistry',
        handwritingStyle: HandwritingStyle.PRINT,
      });

      expect(result.items).toEqual(mockGigs);
      expect(result.total).toBe(1);
    });
  });
});
