import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { UpdateAssignmentDto } from './dto/update-assignment.dto.js';
import { CreateBidDto } from './dto/create-bid.dto.js';
import { QueryAssignmentsDto } from './dto/query-assignments.dto.js';
import { AssignmentStatus, BidStatus, OrderStatus, EscrowStatus, VerificationStatus } from '@prisma/client';

export const ASSIGNMENT_PUBLIC_INCLUDE = {
  customer: {
    select: {
      id: true,
      name: true,
      image: true,
      createdAt: true,
    },
  },
} as const;

export const BID_VENDOR_INCLUDE = {
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
        },
      },
    },
  },
} as const;

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Business rules for job posting (students / customers only):
   * - Max 5 job posts per rolling 7-day window.
   * - Max 3 active (OPEN or ASSIGNED) job posts at any one time.
   */
  private static readonly WEEKLY_POST_LIMIT = 5;
  private static readonly ACTIVE_POST_LIMIT = 3;
  private static readonly WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

  /**
   * Creates a new assignment request / job post.
   * Enforces the weekly (5) and concurrent active (3) posting limits for customers.
   */
  async create(customerId: string, dto: CreateAssignmentDto) {
    if (dto.budgetMin > dto.budgetMax) {
      throw new ConflictException('Minimum budget cannot exceed maximum budget');
    }

    await this.enforcePostingLimits(customerId);

    const assignment = await this.prisma.assignment.create({
      data: {
        customerId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        subject: dto.subject,
        type: dto.type,
        deadline: new Date(dto.deadline),
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        deliveryAddress: dto.deliveryAddress,
        preferredCampus: dto.preferredCampus,
        preferredHandwritingStyle: dto.preferredHandwritingStyle,
        sampleFileUrls: dto.sampleFileUrls ?? [],
        status: AssignmentStatus.OPEN,
      },
      include: ASSIGNMENT_PUBLIC_INCLUDE,
    });

    this.logger.log(`Created Assignment '${assignment.title}' (id=${assignment.id}) by customerId=${customerId}`);
    return assignment;
  }

  /**
   * Enforces the customer posting quota before a new job post is created.
   */
  private async enforcePostingLimits(customerId: string) {
    const windowStart = new Date(Date.now() - AssignmentsService.WEEKLY_WINDOW_MS);

    const [weeklyCount, activeCount] = await Promise.all([
      this.prisma.assignment.count({
        where: {
          customerId,
          createdAt: { gte: windowStart },
        },
      }),
      this.prisma.assignment.count({
        where: {
          customerId,
          status: { in: [AssignmentStatus.OPEN, AssignmentStatus.ASSIGNED] },
        },
      }),
    ]);

    if (weeklyCount >= AssignmentsService.WEEKLY_POST_LIMIT) {
      throw new ConflictException(
        `Weekly job posting limit reached (${AssignmentsService.WEEKLY_POST_LIMIT} per 7 days). Please wait before posting again.`,
      );
    }

    if (activeCount >= AssignmentsService.ACTIVE_POST_LIMIT) {
      throw new ConflictException(
        `You already have ${AssignmentsService.ACTIVE_POST_LIMIT} active jobs with helpers. Complete or close one before posting another.`,
      );
    }
  }

  /**
   * Retrieves an assignment by ID.
   * If viewer is the customer or an admin, reveals all proposals/bids.
   * If viewer is a vendor, reveals only their own bids and public proposal stats.
   */
  async findById(id: string, viewerUserId?: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: {
        ...ASSIGNMENT_PUBLIC_INCLUDE,
        bids: {
          include: BID_VENDOR_INCLUDE,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment '${id}' not found`);
    }

    // If viewer is NOT the customer who created it, filter bids to protect vendor privacy
    const isOwner = viewerUserId && assignment.customerId === viewerUserId;
    if (!isOwner) {
      // If viewer is a vendor, show only viewer's bids
      const filteredBids = viewerUserId
        ? assignment.bids.filter((b) => b.vendorProfile.user.id === viewerUserId)
        : [];

      return {
        ...assignment,
        bids: filteredBids,
      };
    }

    return assignment;
  }

  /**
   * Retrieves all assignment requests posted by the authenticated customer.
   */
  async getMyAssignments(customerId: string) {
    return this.prisma.assignment.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        bids: {
          select: { id: true, proposedPrice: true, status: true },
        },
      },
    });
  }

  /**
   * Updates an assignment request with ownership verification.
   */
  async update(customerId: string, id: string, dto: UpdateAssignmentDto) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment '${id}' not found`);
    }

    if (assignment.customerId !== customerId) {
      throw new ForbiddenException('You do not have permission to update this assignment');
    }

    if (
      assignment.status !== AssignmentStatus.OPEN &&
      dto.status === undefined
    ) {
      throw new ConflictException(
        `Cannot edit assignment details while in '${assignment.status}' status`,
      );
    }

    return this.prisma.assignment.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.deadline !== undefined ? { deadline: new Date(dto.deadline) } : {}),
        ...(dto.budgetMin !== undefined ? { budgetMin: dto.budgetMin } : {}),
        ...(dto.budgetMax !== undefined ? { budgetMax: dto.budgetMax } : {}),
        ...(dto.deliveryAddress !== undefined ? { deliveryAddress: dto.deliveryAddress } : {}),
        ...(dto.preferredCampus !== undefined ? { preferredCampus: dto.preferredCampus } : {}),
        ...(dto.preferredHandwritingStyle !== undefined ? { preferredHandwritingStyle: dto.preferredHandwritingStyle } : {}),
        ...(dto.sampleFileUrls !== undefined ? { sampleFileUrls: dto.sampleFileUrls } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: ASSIGNMENT_PUBLIC_INCLUDE,
    });
  }

  /**
   * Submits a proposal / bid on an open assignment post.
   */
  async submitBid(vendorUserId: string, assignmentId: string, dto: CreateBidDto) {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId: vendorUserId },
    });

    if (!vendorProfile || vendorProfile.verificationStatus !== VerificationStatus.APPROVED) {
      throw new ForbiddenException(
        'Only approved academic helpers can submit bids on assignments',
      );
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment '${assignmentId}' not found`);
    }

    if (assignment.status !== AssignmentStatus.OPEN) {
      throw new ConflictException('This assignment is no longer accepting proposals');
    }

    if (assignment.customerId === vendorUserId) {
      throw new ConflictException('You cannot bid on your own assignment post');
    }

    // Create bid and increment assignment bidsCount atomically
    const [bid] = await this.prisma.$transaction([
      this.prisma.bid.create({
        data: {
          assignmentId,
          vendorProfileId: vendorProfile.id,
          proposedPrice: dto.proposedPrice,
          deliveryDays: dto.deliveryDays,
          coverLetter: dto.coverLetter,
          sampleUrls: dto.sampleUrls ?? [],
          status: BidStatus.PENDING,
        },
        include: BID_VENDOR_INCLUDE,
      }),
      this.prisma.assignment.update({
        where: { id: assignmentId },
        data: { bidsCount: { increment: 1 } },
      }),
    ]);

    this.logger.log(
      `Bid placed by vendorProfileId=${vendorProfile.id} on assignmentId=${assignmentId} for ৳${dto.proposedPrice}`,
    );

    return bid;
  }

  /**
   * Customer accepts a vendor's proposal, marking the assignment as ASSIGNED.
   *
   * This operation is atomic and idempotent:
   *  - Assignment status + acceptedBidId are updated.
   *  - The chosen bid is marked ACCEPTED; all competing bids are REJECTED.
   *  - An order (PENDING_PAYMENT) and its escrow holding (AWAITING_PAYMENT) are created.
   *
   * All writes occur inside a single Prisma transaction, so either everything
   *  commits or nothing does. Repeated calls for the same (assignment, bid)
   *  return the existing order instead of creating duplicates.
   *
   * Authorization: only the assignment owner (customer) may accept a bid.
   */
  async acceptBid(customerId: string, assignmentId: string, bidId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment '${assignmentId}' not found`);
    }

    // Authorization: only the assignment owner (customer) can accept a bid.
    if (assignment.customerId !== customerId) {
      throw new ForbiddenException('You do not have permission to accept bids for this assignment');
    }

    // Idempotency guard: if an order already exists for this assignment+bid,
    // return it without mutating anything. Safe against duplicate requests
    // (e.g. client retry after a successful response was lost in transit).
    const existingOrder = await this.prisma.order.findFirst({
      where: { assignmentId, bidId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerId: true,
        vendorProfileId: true,
        totalAmount: true,
        escrowHolding: true,
      },
    });

    if (existingOrder) {
      this.logger.log(
        `Idempotent acceptBid: order ${existingOrder.id} already exists for assignmentId=${assignmentId} bidId=${bidId}. Returning existing order without mutation.`,
      );

      const acceptedBid = await this.prisma.bid.findUnique({
        where: { id: bidId },
        include: BID_VENDOR_INCLUDE,
      });

      return {
        assignment: { ...assignment, status: AssignmentStatus.ASSIGNED },
        acceptedBid,
        order: existingOrder,
        idempotent: true,
      };
    }

    if (assignment.status !== AssignmentStatus.OPEN) {
      throw new ConflictException(
        `Assignment cannot accept proposals because it is already '${assignment.status}'`,
      );
    }

    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: BID_VENDOR_INCLUDE,
    });

    if (!bid || bid.assignmentId !== assignmentId) {
      throw new NotFoundException('Selected proposal does not exist on this assignment');
    }

    if (bid.status !== BidStatus.PENDING) {
      throw new ConflictException(`Bid '${bidId}' is already '${bid.status}' and cannot be accepted`);
    }

    // Financials derived from the accepted bid.
    const totalAmount = bid.proposedPrice;
    const platformFee = Math.round(totalAmount * 0.10); // Standard 10% platform fee
    const netVendorAmount = totalAmount - platformFee;
    const deadline = new Date(Date.now() + bid.deliveryDays * 24 * 60 * 60 * 1000);
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date();

    // Single atomic transaction: assignment + bids + order + escrow holding.
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Mark assignment ASSIGNED and record the accepted bid.
      const updatedAssignment = await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.ASSIGNED,
          acceptedBidId: bidId,
        },
        include: ASSIGNMENT_PUBLIC_INCLUDE,
      });

      // 2. Accept the chosen bid.
      const acceptedBid = await tx.bid.update({
        where: { id: bidId },
        data: { status: BidStatus.ACCEPTED },
        include: BID_VENDOR_INCLUDE,
      });

      // 3. Reject all competing bids on this assignment.
      await tx.bid.updateMany({
        where: {
          assignmentId,
          id: { not: bidId },
        },
        data: { status: BidStatus.REJECTED },
      });

      // 4. Create the order in PENDING_PAYMENT (funding still required to activate).
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          vendorProfileId: bid.vendorProfileId,
          assignmentId: assignment.id,
          bidId: bid.id,
          title: assignment.title,
          totalAmount,
          platformFee,
          netVendorAmount,
          status: OrderStatus.PENDING_PAYMENT,
          customerAcceptedAt: now,
          deadline,
          maxRevisions: 2, // Standard 2 revisions for assignments
        },
      });

      // 5. Create the escrow holding in AWAITING_PAYMENT.
      await tx.escrowHolding.create({
        data: {
          orderId: order.id,
          amount: totalAmount,
          status: EscrowStatus.AWAITING_PAYMENT,
        },
      });

      return { assignment: updatedAssignment, acceptedBid, order };
    });

    this.logger.log(
      `Accepted bidId=${bidId} on assignmentId=${assignmentId}. Order ${result.order.id} created. Other proposals marked rejected.`,
    );

    return {
      assignment: result.assignment,
      acceptedBid: result.acceptedBid,
      order: result.order,
      idempotent: false,
    };
  }

  /**
   * Retrieves all proposals submitted by the authenticated vendor.
   */
  async getMyBids(vendorUserId: string) {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId: vendorUserId },
    });

    if (!vendorProfile) {
      return [];
    }

    return this.prisma.bid.findMany({
      where: { vendorProfileId: vendorProfile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            subject: true,
            deadline: true,
            status: true,
            budgetMin: true,
            budgetMax: true,
            type: true,
          },
        },
      },
    });
  }

  /**
   * Public search & filtering for assignment posts.
   */
  async search(query: QueryAssignmentsDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 12));
    const skip = (page - 1) * limit;

    const where: any = {
      status: query.status ?? AssignmentStatus.OPEN,
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.subject) {
      where.subject = { contains: query.subject, mode: 'insensitive' };
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.preferredCampus) {
      where.preferredCampus = { contains: query.preferredCampus, mode: 'insensitive' };
    }

    if (query.handwritingStyle) {
      where.preferredHandwritingStyle = query.handwritingStyle;
    }

    if (query.minBudget !== undefined || query.maxBudget !== undefined) {
      where.budgetMax = {};
      if (query.minBudget !== undefined) where.budgetMax.gte = query.minBudget;
      if (query.maxBudget !== undefined) where.budgetMin = { lte: query.maxBudget };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { subject: { contains: query.search, mode: 'insensitive' } },
        { preferredCampus: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (query.sortBy === 'deadline') {
      orderBy = { deadline: 'asc' };
    } else if (query.sortBy === 'budget_asc') {
      orderBy = { budgetMin: 'asc' };
    } else if (query.sortBy === 'budget_desc') {
      orderBy = { budgetMax: 'desc' };
    } else if (query.sortBy === 'bids') {
      orderBy = { bidsCount: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.assignment.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: ASSIGNMENT_PUBLIC_INCLUDE,
      }),
      this.prisma.assignment.count({ where }),
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
