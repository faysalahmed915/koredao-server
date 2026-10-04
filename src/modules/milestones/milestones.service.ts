import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto.js';
import { SubmitCheckpointProgressDto } from './dto/submit-checkpoint-progress.dto.js';
import { ReviewCheckpointDto, CheckpointReviewDecision } from './dto/review-checkpoint.dto.js';
import { CheckpointStatus, OrderStatus } from '@prisma/client';

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper creates a new milestone checkpoint for an active order
   */
  async createCheckpoint(vendorUserId: string, dto: CreateCheckpointDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { vendorProfile: true },
    });

    if (!order) {
      throw new NotFoundException(`Order '${dto.orderId}' not found`);
    }

    if (order.vendorProfile.userId !== vendorUserId) {
      throw new ForbiddenException('Only the assigned helper can create milestone checkpoints');
    }

    if (
      order.status !== OrderStatus.ESCROW_HELD &&
      order.status !== OrderStatus.IN_PROGRESS
    ) {
      throw new ConflictException(
        `Checkpoints can only be created while order is in ESCROW_HELD or IN_PROGRESS status (current: ${order.status})`,
      );
    }

    const checkpoint = await this.prisma.projectCheckpoint.create({
      data: {
        orderId: dto.orderId,
        title: dto.title,
        description: dto.description,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        status: CheckpointStatus.PENDING,
      },
    });

    this.logger.log(
      `Milestone checkpoint created: id=${checkpoint.id}, title="${checkpoint.title}", orderId=${dto.orderId}`,
    );

    return checkpoint;
  }

  /**
   * Retrieves all checkpoints for an order (Accessible to client or assigned helper)
   */
  async getOrderCheckpoints(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vendorProfile: true },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    const isCustomer = order.customerId === userId;
    const isVendor = order.vendorProfile.userId === userId;

    if (!isCustomer && !isVendor) {
      throw new ForbiddenException('You do not have permission to view checkpoints for this order');
    }

    return this.prisma.projectCheckpoint.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Helper submits progress, proof photos (handwriting), or courier slips for a checkpoint
   */
  async submitProgress(
    vendorUserId: string,
    checkpointId: string,
    dto: SubmitCheckpointProgressDto,
  ) {
    const checkpoint = await this.prisma.projectCheckpoint.findUnique({
      where: { id: checkpointId },
      include: {
        order: {
          include: { vendorProfile: true },
        },
      },
    });

    if (!checkpoint) {
      throw new NotFoundException(`Checkpoint '${checkpointId}' not found`);
    }

    if (checkpoint.order.vendorProfile.userId !== vendorUserId) {
      throw new ForbiddenException('Only the assigned helper can submit progress for this checkpoint');
    }

    if (
      checkpoint.order.status !== OrderStatus.ESCROW_HELD &&
      checkpoint.order.status !== OrderStatus.IN_PROGRESS
    ) {
      throw new ConflictException('Order is no longer active');
    }

    const updated = await this.prisma.projectCheckpoint.update({
      where: { id: checkpointId },
      data: {
        status: CheckpointStatus.SUBMITTED,
        submittedFileUrl: dto.submittedFileUrl || checkpoint.submittedFileUrl,
        proofPhotoUrls: dto.proofPhotoUrls || checkpoint.proofPhotoUrls,
        courierTracking: dto.courierTracking || checkpoint.courierTracking,
        vendorNotes: dto.vendorNotes || checkpoint.vendorNotes,
        submittedAt: new Date(),
      },
    });

    this.logger.log(`Checkpoint ${checkpointId} progress submitted by helper.`);
    return updated;
  }

  /**
   * Client reviews submitted checkpoint progress (Accepts or Requests Revision)
   */
  async reviewCheckpoint(
    customerUserId: string,
    checkpointId: string,
    dto: ReviewCheckpointDto,
  ) {
    const checkpoint = await this.prisma.projectCheckpoint.findUnique({
      where: { id: checkpointId },
      include: { order: true },
    });

    if (!checkpoint) {
      throw new NotFoundException(`Checkpoint '${checkpointId}' not found`);
    }

    if (checkpoint.order.customerId !== customerUserId) {
      throw new ForbiddenException('Only the client who placed this order can review checkpoints');
    }

    if (checkpoint.status !== CheckpointStatus.SUBMITTED) {
      throw new ConflictException(
        `Checkpoint is in ${checkpoint.status} status and cannot be reviewed (must be SUBMITTED)`,
      );
    }

    const newStatus =
      dto.status === CheckpointReviewDecision.ACCEPTED
        ? CheckpointStatus.ACCEPTED
        : CheckpointStatus.REVISION_REQUESTED;

    const updated = await this.prisma.projectCheckpoint.update({
      where: { id: checkpointId },
      data: {
        status: newStatus,
        clientFeedback: dto.clientFeedback,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(
      `Checkpoint ${checkpointId} reviewed by client: decision=${newStatus}`,
    );

    return updated;
  }

  /**
   * Helper removes a pending milestone checkpoint
   */
  async deleteCheckpoint(vendorUserId: string, checkpointId: string) {
    const checkpoint = await this.prisma.projectCheckpoint.findUnique({
      where: { id: checkpointId },
      include: {
        order: {
          include: { vendorProfile: true },
        },
      },
    });

    if (!checkpoint) {
      throw new NotFoundException(`Checkpoint '${checkpointId}' not found`);
    }

    if (checkpoint.order.vendorProfile.userId !== vendorUserId) {
      throw new ForbiddenException('Only the assigned helper can delete this checkpoint');
    }

    if (checkpoint.status === CheckpointStatus.ACCEPTED) {
      throw new ConflictException('Cannot delete an already accepted milestone');
    }

    await this.prisma.projectCheckpoint.delete({
      where: { id: checkpointId },
    });

    return { success: true, message: 'Checkpoint removed successfully' };
  }
}
