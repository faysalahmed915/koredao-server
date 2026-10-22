import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { CreateDraftAssignmentDto } from './dto/create-draft-assignment.dto.js';
import { UpdateDraftAssignmentDto } from './dto/update-draft-assignment.dto.js';
import { PublishDraftDto } from './dto/update-draft-assignment.dto.js';
import {
  DraftStatus,
  AssignmentStatus,
  UserRole,
} from '@prisma/client';

/**
 * Draft assignment persistence for students.
 *
 * Allows a student to save an in-progress assignment request and resume or
 * publish it later. Drafts are owned by the creating user and are invisible to
 * other users until published as a real `Assignment`.
 */
@Injectable()
export class DraftAssignmentsService {
  private readonly logger = new Logger(DraftAssignmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** List all drafts owned by the authenticated user, newest first. */
  async listMyDrafts(userId: string) {
    return this.prisma.draftAssignment.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Get a single draft by ID, ensuring the caller is the owner. */
  async getDraft(userId: string, draftId: string) {
    const draft = await this.prisma.draftAssignment.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      throw new NotFoundException(`Draft '${draftId}' not found`);
    }

    if (draft.userId !== userId) {
      throw new ForbiddenException('You do not own this draft');
    }

    return draft;
  }

  /** Create a new draft assignment. */
  async createDraft(userId: string, dto: CreateDraftAssignmentDto) {
    if (dto.budgetMin > dto.budgetMax) {
      throw new ConflictException('Minimum budget cannot exceed maximum budget');
    }

    const draft = await this.prisma.draftAssignment.create({
      data: {
        userId,
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
        status: dto.status ?? DraftStatus.DRAFT,
      },
    });

    this.logger.log(
      `Created DraftAssignment '${draft.title}' (id=${draft.id}) by userId=${userId}`,
    );
    return draft;
  }

  /** Update an existing draft (auto-save). Only the owner may update. */
  async updateDraft(
    userId: string,
    draftId: string,
    dto: UpdateDraftAssignmentDto,
  ) {
    await this.getDraft(userId, draftId); // enforces ownership + existence

    if (
      dto.budgetMin !== undefined &&
      dto.budgetMax !== undefined &&
      dto.budgetMin > dto.budgetMax
    ) {
      throw new ConflictException('Minimum budget cannot exceed maximum budget');
    }

    const draft = await this.prisma.draftAssignment.update({
      where: { id: draftId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.deadline !== undefined && { deadline: new Date(dto.deadline) }),
        ...(dto.budgetMin !== undefined && { budgetMin: dto.budgetMin }),
        ...(dto.budgetMax !== undefined && { budgetMax: dto.budgetMax }),
        ...(dto.deliveryAddress !== undefined && {
          deliveryAddress: dto.deliveryAddress,
        }),
        ...(dto.preferredCampus !== undefined && {
          preferredCampus: dto.preferredCampus,
        }),
        ...(dto.preferredHandwritingStyle !== undefined && {
          preferredHandwritingStyle: dto.preferredHandwritingStyle,
        }),
        ...(dto.sampleFileUrls !== undefined && {
          sampleFileUrls: dto.sampleFileUrls,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    this.logger.log(
      `Updated DraftAssignment id=${draft.id} by userId=${userId}`,
    );
    return draft;
  }

  /** Delete a draft. Only the owner may delete. */
  async deleteDraft(userId: string, draftId: string) {
    await this.getDraft(userId, draftId); // enforces ownership + existence

    await this.prisma.draftAssignment.delete({
      where: { id: draftId },
    });

    this.logger.log(
      `Deleted DraftAssignment id=${draftId} by userId=${userId}`,
    );
    return { id: draftId, deleted: true };
  }

  /**
   * Publish a draft as a real Assignment.
   * Requires an active MEMBER membership (the same gate as posting an assignment
   * directly). The draft is archived after publishing.
   */
  async publishDraft(userId: string, draftId: string, dto: PublishDraftDto) {
    const draft = await this.getDraft(userId, draftId); // enforces ownership

    if (draft.status !== DraftStatus.DRAFT) {
      throw new ConflictException(
        `Draft '${draftId}' is already ${draft.status.toLowerCase()}`,
      );
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        customerId: userId,
        title: dto.title ?? draft.title,
        description: dto.description ?? draft.description,
        category: draft.category,
        subject: draft.subject,
        type: draft.type,
        deadline: draft.deadline,
        budgetMin: draft.budgetMin,
        budgetMax: draft.budgetMax,
        deliveryAddress: draft.deliveryAddress,
        preferredCampus: draft.preferredCampus,
        preferredHandwritingStyle: draft.preferredHandwritingStyle,
        sampleFileUrls: draft.sampleFileUrls,
        status: AssignmentStatus.OPEN,
      },
    });

    // Archive the draft so it cannot be republished
    await this.prisma.draftAssignment.update({
      where: { id: draftId },
      data: { status: DraftStatus.PUBLISHED },
    });

    this.logger.log(
      `Published DraftAssignment id=${draftId} as Assignment id=${assignment.id} by userId=${userId}`,
    );
    return { assignment, draftId };
  }

}
