import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { Prisma, WalletTransactionType } from '@prisma/client';
import {
  BulkVendorApplicationItemDto,
  BulkVendorApplicationsDto,
} from './dto/bulk-vendor-applications.dto.js';
import {
  BulkRoleItemDto,
  BulkRolesDto,
} from './dto/bulk-roles.dto.js';
import {
  BulkPayoutItemDto,
  BulkPayoutsDto,
} from './dto/bulk-payouts.dto.js';

@Injectable()
export class BulkActionsService {
  private readonly logger = new Logger(BulkActionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async reviewVendorApplications(
    dto: BulkVendorApplicationsDto,
  ): Promise<{ reviewed: number; approved: number; rejected: number }> {
    const items = dto.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new ConflictException('No items provided');
    }

    let approved = 0;
    let rejected = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const profile = await tx.vendorProfile.findUnique({
          where: { id: item.profileId },
        });
        if (!profile) {
          throw new NotFoundException(
            `VendorProfile '${item.profileId}' not found`,
          );
        }

        if (profile.verificationStatus !== 'PENDING') {
          throw new ConflictException(
            `VendorProfile '${item.profileId}' is not pending verification`,
          );
        }

        await tx.vendorProfile.update({
          where: { id: item.profileId },
          data: {
            verificationStatus: item.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
            verifiedAt: item.status === 'APPROVED' ? new Date() : undefined,
            rejectionReason: item.status === 'APPROVED' ? null : (item.reason ?? null),
          },
        });

        if (item.status === 'APPROVED') {
          approved++;
        } else {
          rejected++;
        }
      }
    });

    return { reviewed: items.length, approved, rejected };
  }

  async bulkChangeRoles(
    dto: BulkRolesDto,
  ): Promise<{ changed: number; failures: string[] }> {
    const items = dto.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new ConflictException('No role change items provided');
    }

    const failures: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const user = await tx.user.findUnique({
          where: { id: item.userId },
        });
        if (!user) {
          failures.push(item.userId);
          continue;
        }

        await tx.roleChangeAudit.create({
          data: {
            targetUserId: item.userId,
            oldRole: user.role,
            newRole: item.role,
            changedById: dto.changedById,
            reason: item.reason ?? null,
          },
        });

        await tx.user.update({
          where: { id: item.userId },
          data: { role: item.role },
        });

        this.logger.log(
          `Bulk changed role for user ${item.userId} to ${item.role} ${
            item.reason ?? ''
          }`,
        );
      }
    });

    return { changed: items.length - failures.length, failures };
  }

  async bulkProcessPayouts(
    dto: BulkPayoutsDto,
  ): Promise<{ processed: number; created: number; failures: string[] }> {
    const items = dto.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new ConflictException('No payout items provided');
    }

    const failures: string[] = [];
    let processed = 0;
    let created = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const order = await tx.order.findUnique({
          where: { id: item.orderId },
          include: { vendorProfile: { include: { wallet: true } } },
        });
        if (!order) {
          failures.push(item.orderId);
          continue;
        }

        if (order.status !== 'COMPLETED') {
          failures.push(item.orderId);
          continue;
        }

        const alreadyPaid = await tx.walletTransaction.findFirst({
          where: { orderId: item.orderId, type: WalletTransactionType.WITHDRAWAL },
        });
        if (alreadyPaid) {
          failures.push(item.orderId);
          continue;
        }

        const wallet = order.vendorProfile?.wallet;
        if (!wallet) {
          failures.push(item.orderId);
          continue;
        }

        const amount = Math.min(item.amount, order.netVendorAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
          failures.push(item.orderId);
          continue;
        }

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            orderId: item.orderId,
            amount,
            type: WalletTransactionType.WITHDRAWAL,
            description: `Bulk payout for order ${item.orderId}`,
            payoutMethod: item.method,
            payoutAccount: item.reference ?? null,
          },
        });

        processed++;
        created++;

        this.logger.log(
          `Bulk payout created for order ${item.orderId} amount=${amount} method=${item.method}`,
        );
      }
    });

    return { processed, created, failures };
  }
}
