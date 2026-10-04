import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { CreateVendorApplicationDto } from './dto/create-vendor-application.dto.js';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto.js';
import { ReviewVendorApplicationDto } from './dto/review-vendor-application.dto.js';
import { AddHandwritingSampleDto } from './dto/add-handwriting-sample.dto.js';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto.js';
import { QueryVendorsDto } from './dto/query-vendors.dto.js';
import { UserRole, VerificationStatus } from '@prisma/client';

export const VENDOR_PUBLIC_SELECT = {
  id: true,
  university: true,
  department: true,
  academicLevel: true,
  degree: true,
  passingYear: true,
  bio: true,
  skills: true,
  rating: true,
  totalReviews: true,
  completedOrders: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
  handwritingSamples: {
    select: {
      id: true,
      sampleUrl: true,
      style: true,
      neatnessScore: true,
      description: true,
      isVerified: true,
    },
  },
} as const;

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submits a new vendor application or re-submits a previously rejected application.
   */
  async applyAsVendor(userId: string, dto: CreateVendorApplicationDto) {
    const existing = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      if (existing.verificationStatus === VerificationStatus.APPROVED) {
        throw new ConflictException('You are already an approved vendor on KoreDao');
      }
      if (existing.verificationStatus === VerificationStatus.PENDING) {
        throw new ConflictException(
          'Your vendor application is currently under review by our moderation team',
        );
      }

      // Re-application for previously REJECTED profiles:
      const updated = await this.prisma.vendorProfile.update({
        where: { userId },
        data: {
          university: dto.university,
          department: dto.department,
          academicLevel: dto.academicLevel,
          degree: dto.degree,
          passingYear: dto.passingYear,
          bio: dto.bio,
          skills: dto.skills ?? [],
          idCardUrl: dto.idCardUrl,
          verificationStatus: VerificationStatus.PENDING,
          rejectionReason: null,
          verifiedAt: null,
          verifiedById: null,
          ...(dto.handwritingSamples?.length
            ? {
                handwritingSamples: {
                  create: dto.handwritingSamples.map((s) => ({
                    sampleUrl: s.sampleUrl,
                    style: s.style,
                    neatnessScore: s.neatnessScore ?? 5,
                    description: s.description,
                  })),
                },
              }
            : {}),
        },
        include: {
          handwritingSamples: true,
        },
      });

      this.logger.log(`Vendor re-applied: userId=${userId}, profileId=${updated.id}`);
      return updated;
    }

    // New application creation:
    const profile = await this.prisma.vendorProfile.create({
      data: {
        userId,
        university: dto.university,
        department: dto.department,
        academicLevel: dto.academicLevel,
        degree: dto.degree,
        passingYear: dto.passingYear,
        bio: dto.bio,
        skills: dto.skills ?? [],
        idCardUrl: dto.idCardUrl,
        verificationStatus: VerificationStatus.PENDING,
        ...(dto.handwritingSamples?.length
          ? {
              handwritingSamples: {
                create: dto.handwritingSamples.map((s) => ({
                  sampleUrl: s.sampleUrl,
                  style: s.style,
                  neatnessScore: s.neatnessScore ?? 5,
                  description: s.description,
                })),
              },
            }
          : {}),
      },
      include: {
        handwritingSamples: true,
      },
    });

    this.logger.log(`New vendor application submitted: userId=${userId}, profileId=${profile.id}`);
    return profile;
  }

  /**
   * Retrieves the vendor profile for the currently authenticated user.
   */
  async getMyVendorProfile(userId: string) {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      include: {
        handwritingSamples: {
          orderBy: { createdAt: 'desc' },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
    });

    return profile;
  }

  /**
   * Updates fields on the authenticated user's vendor profile.
   */
  async updateMyVendorProfile(userId: string, dto: UpdateVendorProfileDto) {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Vendor profile not found. Please apply first.');
    }

    return this.prisma.vendorProfile.update({
      where: { userId },
      data: {
        ...(dto.university !== undefined ? { university: dto.university } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.academicLevel !== undefined ? { academicLevel: dto.academicLevel } : {}),
        ...(dto.degree !== undefined ? { degree: dto.degree } : {}),
        ...(dto.passingYear !== undefined ? { passingYear: dto.passingYear } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.skills !== undefined ? { skills: dto.skills } : {}),
        ...(dto.idCardUrl !== undefined ? { idCardUrl: dto.idCardUrl } : {}),
      },
      include: {
        handwritingSamples: true,
      },
    });
  }

  /**
   * Adds a new handwriting sample to the vendor profile.
   */
  async addHandwritingSample(userId: string, dto: AddHandwritingSampleDto) {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Vendor profile not found. Please submit an application first.');
    }

    return this.prisma.handwritingSample.create({
      data: {
        vendorProfileId: profile.id,
        sampleUrl: dto.sampleUrl,
        style: dto.style,
        neatnessScore: dto.neatnessScore ?? 5,
        description: dto.description,
        isVerified: profile.verificationStatus === VerificationStatus.APPROVED,
      },
    });
  }

  /**
   * Removes a handwriting sample belonging to the authenticated vendor.
   */
  async removeHandwritingSample(userId: string, sampleId: string) {
    const sample = await this.prisma.handwritingSample.findUnique({
      where: { id: sampleId },
      include: { vendorProfile: true },
    });

    if (!sample) {
      throw new NotFoundException('Handwriting sample not found');
    }

    if (sample.vendorProfile.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this sample');
    }

    await this.prisma.handwritingSample.delete({
      where: { id: sampleId },
    });

    return { success: true, message: 'Handwriting sample deleted successfully' };
  }

  /**
   * Reviews and approves/rejects a vendor application (Admin/Moderator only).
   */
  async reviewVendorApplication(
    adminId: string,
    profileId: string,
    dto: ReviewVendorApplicationDto,
  ) {
    const profile = await this.prisma.vendorProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException(`Vendor application '${profileId}' not found`);
    }

    const isApproved = dto.status === VerificationStatus.APPROVED;

    // Use transaction to update profile and promote user role safely
    const [updatedProfile] = await this.prisma.$transaction([
      this.prisma.vendorProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: dto.status,
          verifiedAt: isApproved ? new Date() : null,
          verifiedById: isApproved ? adminId : null,
          rejectionReason: isApproved ? null : (dto.rejectionReason ?? 'Application does not meet requirements'),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
          handwritingSamples: true,
        },
      }),
      // When approved, elevate user role to VENDOR if currently CUSTOMER
      ...(isApproved
        ? [
            this.prisma.user.update({
              where: { id: profile.userId },
              data: { role: UserRole.VENDOR },
            }),
            this.prisma.handwritingSample.updateMany({
              where: { vendorProfileId: profileId },
              data: { isVerified: true },
            }),
          ]
        : []),
    ]);

    this.logger.log(
      `Vendor application reviewed: profileId=${profileId}, status=${dto.status}, reviewer=${adminId}`,
    );

    return updatedProfile;
  }

  /**
   * Retrieves paginated pending vendor applications for administrators to review.
   */
  async getPendingApplications(page: number = 1, limit: number = 10) {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      this.prisma.vendorProfile.findMany({
        where: { verificationStatus: VerificationStatus.PENDING },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          handwritingSamples: true,
        },
      }),
      this.prisma.vendorProfile.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  /**
   * Retrieves public profile for a verified vendor (for customer gig/search views).
   */
  async getPublicVendorProfile(id: string) {
    const profile = await this.prisma.vendorProfile.findFirst({
      where: {
        id,
        verificationStatus: VerificationStatus.APPROVED,
      },
      select: VENDOR_PUBLIC_SELECT,
    });

    if (!profile) {
      throw new NotFoundException(`Vendor with ID '${id}' not found or not yet approved`);
    }

    return profile;
  }

  /**
   * Public directory search for approved vendors with academic and handwriting filters.
   */
  async searchVendors(query: QueryVendorsDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {
      verificationStatus: VerificationStatus.APPROVED,
    };

    if (query.university) {
      where.university = { contains: query.university, mode: 'insensitive' };
    }

    if (query.department) {
      where.department = { contains: query.department, mode: 'insensitive' };
    }

    if (query.academicLevel) {
      where.academicLevel = query.academicLevel;
    }

    if (query.handwritingStyle) {
      where.handwritingSamples = {
        some: {
          style: query.handwritingStyle,
        },
      };
    }

    if (query.search) {
      where.OR = [
        { university: { contains: query.search, mode: 'insensitive' } },
        { department: { contains: query.search, mode: 'insensitive' } },
        { bio: { contains: query.search, mode: 'insensitive' } },
        { skills: { has: query.search } },
        { user: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.vendorProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ rating: 'desc' }, { completedOrders: 'desc' }],
        select: VENDOR_PUBLIC_SELECT,
      }),
      this.prisma.vendorProfile.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves or creates customer profile for the current user.
   */
  async getMyCustomerProfile(userId: string) {
    let profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await this.prisma.customerProfile.create({
        data: { userId },
      });
    }

    return profile;
  }

  /**
   * Updates customer profile details.
   */
  async updateMyCustomerProfile(userId: string, dto: UpdateCustomerProfileDto) {
    return this.prisma.customerProfile.upsert({
      where: { userId },
      create: {
        userId,
        university: dto.university,
        department: dto.department,
        phone: dto.phone,
        campus: dto.campus,
      },
      update: {
        ...(dto.university !== undefined ? { university: dto.university } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.campus !== undefined ? { campus: dto.campus } : {}),
      },
    });
  }
}
