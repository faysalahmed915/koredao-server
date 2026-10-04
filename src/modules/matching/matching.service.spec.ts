import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatchingService } from './matching.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { calculateDistanceKm, lookupCampus } from './bangladesh-campuses.js';
import { HandwritingStyle, VerificationStatus } from '@prisma/client';

describe('MatchingService', () => {
  let service: MatchingService;
  let prisma: {
    vendorProfile: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      vendorProfile: {
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
  });

  describe('calculateDistanceKm & lookupCampus', () => {
    it('should calculate accurate distance between DU and BUET (< 1.5 km)', () => {
      const du = lookupCampus('du');
      const buet = lookupCampus('buet');
      expect(du).toBeDefined();
      expect(buet).toBeDefined();

      const dist = calculateDistanceKm(du!.latitude, du!.longitude, buet!.latitude, buet!.longitude);
      expect(dist).toBeLessThan(2.0);
      expect(dist).toBeGreaterThan(0.2);
    });

    it('should perform fuzzy lookup for university names', () => {
      const match = lookupCampus('Shahjalal University');
      expect(match).toBeDefined();
      expect(match?.shortName).toBe('SUST');
    });
  });

  describe('matchHelpers', () => {
    it('should rank helper with same university and matching handwriting style highest', async () => {
      prisma.vendorProfile.findMany.mockResolvedValue([
        {
          id: 'vp-du',
          userId: 'usr-1',
          university: 'University of Dhaka',
          department: 'Mathematics',
          academicLevel: 'UNDERGRADUATE',
          rating: 4.9,
          totalReviews: 12,
          completedOrders: 15,
          user: { id: 'usr-1', name: 'Tanvir Hasan', image: null },
          handwritingSamples: [
            {
              id: 'hs-1',
              sampleUrl: 'https://example.com/cursive.jpg',
              style: HandwritingStyle.CURSIVE,
              neatnessScore: 5,
              isVerified: true,
            },
          ],
        },
        {
          id: 'vp-other',
          userId: 'usr-2',
          university: 'Chittagong University',
          department: 'History',
          academicLevel: 'GRADUATE',
          rating: 4.0,
          totalReviews: 2,
          completedOrders: 3,
          user: { id: 'usr-2', name: 'Karim Ahmed', image: null },
          handwritingSamples: [],
        },
      ]);

      const results = await service.matchHelpers({
        university: 'University of Dhaka',
        handwritingStyle: HandwritingStyle.CURSIVE,
        desiredNeatness: 5,
      });

      expect(results.length).toBe(2);
      expect(results[0].helperId).toBe('vp-du');
      expect(results[0].matchScore).toBeGreaterThan(results[1].matchScore);
      expect(results[0].matchHighlights).toContain('Same Campus (University of Dhaka)');
      expect(results[0].matchingSample?.style).toBe(HandwritingStyle.CURSIVE);
      expect(prisma.vendorProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            verificationStatus: VerificationStatus.APPROVED,
          }),
        }),
      );
    });
  });
});
