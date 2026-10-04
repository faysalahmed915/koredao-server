import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { MatchHelpersDto } from './dto/match-helpers.dto.js';
import {
  calculateDistanceKm,
  lookupCampus,
} from './bangladesh-campuses.js';
import { VerificationStatus, HandwritingStyle } from '@prisma/client';

export interface MatchedHelperResult {
  helperId: string;
  userId: string;
  name: string;
  image?: string | null;
  university: string;
  department: string;
  academicLevel: string;
  rating: number;
  totalReviews: number;
  completedOrders: number;
  distanceKm?: number;
  locationName?: string | null;
  matchScore: number;
  proximityScore: number;
  handwritingScore: number;
  matchingSample?: {
    id: string;
    sampleUrl: string;
    style: HandwritingStyle;
    neatnessScore: number;
    isVerified: boolean;
  };
  sampleComparisonUrl?: string;
  matchHighlights: string[];
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Smart matchmaking engine combining campus proximity, department matching,
   * and handwriting visual style alignment with minimal server CPU load.
   */
  async matchHelpers(dto: MatchHelpersDto): Promise<MatchedHelperResult[]> {
    // 1. Resolve student coordinates (either provided GPS or O(1) in-memory campus lookup)
    let studentLat = dto.latitude;
    let studentLon = dto.longitude;

    if (!studentLat || !studentLon) {
      const detected =
        lookupCampus(dto.university || '') ||
        lookupCampus(dto.locationName || '');
      if (detected) {
        studentLat = detected.latitude;
        studentLon = detected.longitude;
      }
    }

    // 2. Build Prisma where clause
    const where: any = {
      verificationStatus: VerificationStatus.APPROVED,
    };

    if (dto.department) {
      where.department = { contains: dto.department, mode: 'insensitive' };
    }

    // 3. Query approved helpers with handwriting samples and user info
    const helpers = await this.prisma.vendorProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, image: true } },
        handwritingSamples: true,
      },
    });

    const targetNeatness = dto.desiredNeatness ?? 5;

    // 4. Compute composite matching score in memory
    const results: MatchedHelperResult[] = [];

    for (const helper of helpers) {
      const highlights: string[] = [];
      let proximityScore = 50; // base nationwide score
      let distanceKm: number | undefined;

      // --- Campus & Proximity Scoring ---
      const isSameUniversity =
        dto.university &&
        helper.university.toLowerCase().includes(dto.university.toLowerCase());

      if (isSameUniversity) {
        proximityScore = 100;
        highlights.push(`Same Campus (${helper.university})`);
      } else if (studentLat && studentLon) {
        // Resolve helper location (direct coords or campus lookup)
        let helperLat = helper.latitude;
        let helperLon = helper.longitude;

        if (!helperLat || !helperLon) {
          const hCampus = lookupCampus(helper.university);
          if (hCampus) {
            helperLat = hCampus.latitude;
            helperLon = hCampus.longitude;
          }
        }

        if (helperLat && helperLon) {
          distanceKm = calculateDistanceKm(
            studentLat,
            studentLon,
            helperLat,
            helperLon,
          );

          if (distanceKm <= 5) {
            proximityScore = 95;
            highlights.push(`Within walking distance (${distanceKm} km)`);
          } else if (distanceKm <= 15) {
            proximityScore = 85;
            highlights.push(`Within campus zone (${distanceKm} km)`);
          } else if (distanceKm <= 35) {
            proximityScore = 75;
            highlights.push(`Same metropolitan area (${distanceKm} km)`);
          } else {
            proximityScore = Math.max(30, 70 - Math.round(distanceKm / 10));
          }

          if (dto.maxDistanceKm && distanceKm > dto.maxDistanceKm) {
            continue; // Filter out helpers outside requested radius
          }
        }
      }

      // --- Department & Faculty Bonus ---
      if (
        dto.department &&
        helper.department.toLowerCase().includes(dto.department.toLowerCase())
      ) {
        highlights.push(`Same Faculty (${helper.department})`);
      }

      // --- Handwriting Style & Neatness Scoring ---
      let handwritingScore = 50;
      let bestSample: any = null;

      if (helper.handwritingSamples.length > 0) {
        let bestSampleScore = 0;

        for (const sample of helper.handwritingSamples) {
          let sScore = 60;

          if (dto.handwritingStyle) {
            if (sample.style === dto.handwritingStyle) {
              sScore += 30;
            } else if (
              sample.style === HandwritingStyle.MIXED ||
              dto.handwritingStyle === HandwritingStyle.MIXED
            ) {
              sScore += 15;
            }
          }

          // Neatness closeness (0 to 10 points)
          const neatnessDiff = Math.abs(targetNeatness - sample.neatnessScore);
          sScore += Math.max(0, 10 - neatnessDiff * 2);

          if (sample.isVerified) {
            sScore += 5;
          }

          if (sScore > bestSampleScore) {
            bestSampleScore = sScore;
            bestSample = sample;
          }
        }

        handwritingScore = Math.min(100, bestSampleScore);

        if (bestSample && dto.handwritingStyle && bestSample.style === dto.handwritingStyle) {
          highlights.push(`Matched Style: ${bestSample.style}`);
        }
      }

      // --- Composite Score Calculation ---
      let matchScore: number;
      if (dto.handwritingStyle || dto.handwritingSampleUrl) {
        // Handwriting prioritization
        matchScore = Math.round(handwritingScore * 0.6 + proximityScore * 0.4);
      } else {
        // Proximity prioritization
        matchScore = Math.round(proximityScore * 0.7 + handwritingScore * 0.3);
      }

      // Rating bonus
      if (helper.rating >= 4.5) {
        matchScore = Math.min(100, matchScore + 3);
        highlights.push(`Top Rated Helper (⭐ ${helper.rating.toFixed(1)})`);
      }

      results.push({
        helperId: helper.id,
        userId: helper.userId,
        name: helper.user.name,
        image: helper.user.image,
        university: helper.university,
        department: helper.department,
        academicLevel: helper.academicLevel,
        rating: helper.rating,
        totalReviews: helper.totalReviews,
        completedOrders: helper.completedOrders,
        distanceKm,
        locationName: helper.locationName,
        matchScore,
        proximityScore,
        handwritingScore,
        matchingSample: bestSample
          ? {
              id: bestSample.id,
              sampleUrl: bestSample.sampleUrl,
              style: bestSample.style,
              neatnessScore: bestSample.neatnessScore,
              isVerified: bestSample.isVerified,
            }
          : undefined,
        sampleComparisonUrl: dto.handwritingSampleUrl,
        matchHighlights: highlights,
      });
    }

    // Sort descending by match score
    results.sort((a, b) => b.matchScore - a.matchScore);

    this.logger.log(
      `Handwriting & Campus matcher returned ${results.length} ranked helpers for query university="${dto.university || ''}", style="${dto.handwritingStyle || ''}"`,
    );

    return results;
  }
}
