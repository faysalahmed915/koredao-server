import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { CreateGigDto } from './dto/create-gig.dto.js';
import { UpdateGigDto } from './dto/update-gig.dto.js';
import { QueryGigsDto } from './dto/query-gigs.dto.js';
import { VerificationStatus } from '@prisma/client';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const GIG_PUBLIC_INCLUDE = {
  vendorProfile: {
    select: {
      id: true,
      university: true,
      department: true,
      academicLevel: true,
      degree: true,
      rating: true,
      totalReviews: true,
      completedOrders: true,
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
        },
      },
    },
  },
  attachments: {
    where: {
      isPublicDemo: true,
    },
    select: {
      id: true,
      fileUrl: true,
      fileName: true,
      fileType: true,
      fileSize: true,
    },
  },
} as const;

@Injectable()
export class GigsService {
  private readonly logger = new Logger(GigsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new academic service Gig. Only approved vendors can create gigs.
   */
  async create(userId: string, dto: CreateGigDto) {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });

    if (!vendorProfile) {
      throw new ForbiddenException(
        'You must apply and be approved as an academic helper before creating gigs',
      );
    }

    if (vendorProfile.verificationStatus !== VerificationStatus.APPROVED) {
      throw new ForbiddenException(
        'Your helper profile is not approved yet. Only verified helpers can create gigs.',
      );
    }

    if (!dto.packages || dto.packages.length === 0) {
      throw new ConflictException('A gig must contain at least one package definition');
    }

    // Determine priceFrom and base delivery days from package options
    const prices = dto.packages.map((p) => p.price);
    const priceFrom = Math.min(...prices);
    const deliveries = dto.packages.map((p) => p.deliveryDays);
    const baseDeliveryDays = Math.min(...deliveries);

    // Generate unique slug
    const baseSlug = slugify(dto.title);
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const slug = `${baseSlug}-${uniqueSuffix}`;

    const gig = await this.prisma.gig.create({
      data: {
        vendorProfileId: vendorProfile.id,
        title: dto.title,
        slug,
        description: dto.description,
        category: dto.category,
        subjectTags: dto.subjectTags ?? [],
        coverImages: dto.coverImages ?? [],
        tierType: dto.tierType,
        priceFrom,
        deliveryDays: baseDeliveryDays,
        packages: dto.packages as any,
        requiresHardcopy: dto.requiresHardcopy ?? false,
        handwritingStyle: dto.handwritingStyle,
        ...(dto.attachments?.length
          ? {
              attachments: {
                create: dto.attachments.map((a) => ({
                  fileUrl: a.fileUrl,
                  fileName: a.fileName,
                  fileType: a.fileType,
                  fileSize: a.fileSize,
                  isPublicDemo: a.isPublicDemo ?? true,
                })),
              },
            }
          : {}),
      },
      include: GIG_PUBLIC_INCLUDE,
    });

    this.logger.log(`Created Gig '${gig.title}' (id=${gig.id}) by vendorProfile=${vendorProfile.id}`);
    return gig;
  }

  /**
   * Retrieves single public gig by slug or ID.
   */
  async findBySlug(slug: string) {
    const gig = await this.prisma.gig.findUnique({
      where: { slug },
      include: GIG_PUBLIC_INCLUDE,
    });

    if (!gig || !gig.isActive) {
      throw new NotFoundException(`Gig '${slug}' not found or is currently inactive`);
    }

    return gig;
  }

  /**
   * Retrieves single gig by internal ID.
   */
  async findById(id: string) {
    const gig = await this.prisma.gig.findUnique({
      where: { id },
      include: GIG_PUBLIC_INCLUDE,
    });

    if (!gig) {
      throw new NotFoundException(`Gig '${id}' not found`);
    }

    return gig;
  }

  /**
   * Retrieves all gigs belonging to the authenticated vendor.
   */
  async getMyGigs(userId: string) {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
    });

    if (!vendorProfile) {
      return [];
    }

    return this.prisma.gig.findMany({
      where: { vendorProfileId: vendorProfile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: true,
      },
    });
  }

  /**
   * Updates an existing gig with ownership validation.
   */
  async update(userId: string, gigId: string, dto: UpdateGigDto) {
    const gig = await this.prisma.gig.findUnique({
      where: { id: gigId },
      include: { vendorProfile: true },
    });

    if (!gig) {
      throw new NotFoundException(`Gig '${gigId}' not found`);
    }

    if (gig.vendorProfile.userId !== userId) {
      throw new ForbiddenException('You do not have permission to update this gig');
    }

    let priceFrom = gig.priceFrom;
    let baseDeliveryDays = gig.deliveryDays;

    if (dto.packages && dto.packages.length > 0) {
      priceFrom = Math.min(...dto.packages.map((p) => p.price));
      baseDeliveryDays = Math.min(...dto.packages.map((p) => p.deliveryDays));
    }

    return this.prisma.gig.update({
      where: { id: gigId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.subjectTags !== undefined ? { subjectTags: dto.subjectTags } : {}),
        ...(dto.coverImages !== undefined ? { coverImages: dto.coverImages } : {}),
        ...(dto.tierType !== undefined ? { tierType: dto.tierType } : {}),
        ...(dto.packages !== undefined ? { packages: dto.packages as any, priceFrom, deliveryDays: baseDeliveryDays } : {}),
        ...(dto.requiresHardcopy !== undefined ? { requiresHardcopy: dto.requiresHardcopy } : {}),
        ...(dto.handwritingStyle !== undefined ? { handwritingStyle: dto.handwritingStyle } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: GIG_PUBLIC_INCLUDE,
    });
  }

  /**
   * Deletes a gig with ownership verification.
   */
  async remove(userId: string, gigId: string) {
    const gig = await this.prisma.gig.findUnique({
      where: { id: gigId },
      include: { vendorProfile: true },
    });

    if (!gig) {
      throw new NotFoundException(`Gig '${gigId}' not found`);
    }

    if (gig.vendorProfile.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this gig');
    }

    await this.prisma.gig.delete({
      where: { id: gigId },
    });

    return { success: true, message: `Gig '${gig.title}' deleted successfully` };
  }

  /**
   * Public search and filtering for gigs with academic subject matching.
   */
  async search(query: QueryGigsDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 12));
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
      vendorProfile: {
        verificationStatus: VerificationStatus.APPROVED,
      },
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.subject) {
      where.subjectTags = { has: query.subject };
    }

    if (query.university) {
      where.vendorProfile = {
        ...where.vendorProfile,
        university: { contains: query.university, mode: 'insensitive' },
      };
    }

    if (query.requiresHardcopy !== undefined) {
      where.requiresHardcopy = query.requiresHardcopy;
    }

    if (query.handwritingStyle) {
      where.handwritingStyle = query.handwritingStyle;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.priceFrom = {};
      if (query.minPrice !== undefined) where.priceFrom.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.priceFrom.lte = query.maxPrice;
    }

    if (query.maxDeliveryDays !== undefined) {
      where.deliveryDays = { lte: query.maxDeliveryDays };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { subjectTags: { has: query.search } },
        { vendorProfile: { university: { contains: query.search, mode: 'insensitive' } } },
        { vendorProfile: { department: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    // Determine sort ordering
    let orderBy: any = [{ rating: 'desc' }, { orderCount: 'desc' }];
    if (query.sortBy === 'price_asc') {
      orderBy = { priceFrom: 'asc' };
    } else if (query.sortBy === 'price_desc') {
      orderBy = { priceFrom: 'desc' };
    } else if (query.sortBy === 'newest') {
      orderBy = { createdAt: 'desc' };
    } else if (query.sortBy === 'orders') {
      orderBy = { orderCount: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.gig.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: GIG_PUBLIC_INCLUDE,
      }),
      this.prisma.gig.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
