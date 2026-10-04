import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfilesService } from './profiles.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { HandwritingStyle, UserRole, VerificationStatus } from '@prisma/client';

describe('ProfilesService', () => {
  let service: ProfilesService;
  let prisma: {
    vendorProfile: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    customerProfile: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
    handwritingSample: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    user: {
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      vendorProfile: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      customerProfile: {
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
      },
      handwritingSample: {
        create: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        updateMany: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  describe('applyAsVendor', () => {
    it('should create a new pending vendor application with samples', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);
      const mockCreated = {
        id: 'vp-1',
        userId: 'u-1',
        university: 'University of Dhaka',
        department: 'CSE',
        verificationStatus: VerificationStatus.PENDING,
        handwritingSamples: [{ id: 'hs-1', style: HandwritingStyle.CURSIVE }],
      };
      prisma.vendorProfile.create.mockResolvedValue(mockCreated);

      const result = await service.applyAsVendor('u-1', {
        university: 'University of Dhaka',
        department: 'CSE',
        idCardUrl: 'https://cdn.example.com/id.jpg',
        handwritingSamples: [
          { sampleUrl: 'https://cdn.example.com/sample.jpg', style: HandwritingStyle.CURSIVE },
        ],
      });

      expect(result).toEqual(mockCreated);
      expect(prisma.vendorProfile.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if vendor application is already pending or approved', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        verificationStatus: VerificationStatus.APPROVED,
      });

      await expect(
        service.applyAsVendor('u-1', {
          university: 'BUET',
          department: 'EEE',
          idCardUrl: 'https://cdn.example.com/id.jpg',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('reviewVendorApplication', () => {
    it('should approve application, elevate user role to VENDOR, and verify samples', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'u-1',
        verificationStatus: VerificationStatus.PENDING,
      });

      const mockUpdatedProfile = {
        id: 'vp-1',
        userId: 'u-1',
        verificationStatus: VerificationStatus.APPROVED,
      };

      prisma.vendorProfile.update.mockResolvedValue(mockUpdatedProfile);
      prisma.user.update.mockResolvedValue({ id: 'u-1', role: UserRole.VENDOR });
      prisma.handwritingSample.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.reviewVendorApplication('admin-1', 'vp-1', {
        status: VerificationStatus.APPROVED,
      });

      expect(result).toEqual(mockUpdatedProfile);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if application does not exist', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewVendorApplication('admin-1', 'non-existent', {
          status: VerificationStatus.APPROVED,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addHandwritingSample & removeHandwritingSample', () => {
    it('should add handwriting sample for vendor', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vp-1',
        userId: 'u-1',
        verificationStatus: VerificationStatus.APPROVED,
      });
      prisma.handwritingSample.create.mockResolvedValue({
        id: 'hs-1',
        style: HandwritingStyle.PRINT,
        isVerified: true,
      });

      const result = await service.addHandwritingSample('u-1', {
        sampleUrl: 'https://cdn.example.com/s1.jpg',
        style: HandwritingStyle.PRINT,
      });

      expect(result.id).toBe('hs-1');
    });

    it('should prevent deleting a sample owned by another vendor', async () => {
      prisma.handwritingSample.findUnique.mockResolvedValue({
        id: 'hs-1',
        vendorProfile: { userId: 'other-user' },
      });

      await expect(service.removeHandwritingSample('u-1', 'hs-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('searchVendors', () => {
    it('should return paginated list of approved vendors', async () => {
      const mockList = [
        {
          id: 'vp-1',
          university: 'University of Dhaka',
          department: 'CSE',
          rating: 4.9,
        },
      ];
      prisma.vendorProfile.findMany.mockResolvedValue(mockList);
      prisma.vendorProfile.count.mockResolvedValue(1);

      const result = await service.searchVendors({
        university: 'Dhaka',
        handwritingStyle: HandwritingStyle.CURSIVE,
      });

      expect(result.items).toEqual(mockList);
      expect(result.total).toBe(1);
    });
  });
});
