import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { MinRole } from '../../common/decorators/min-role.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';
import { RequireMembership } from '../../common/decorators/require-membership.decorator.js';
import { BulkActionsService } from './bulk-actions.service.js';
import { BulkVendorApplicationsDto } from './dto/bulk-vendor-applications.dto.js';
import { BulkRolesDto } from './dto/bulk-roles.dto.js';
import { BulkPayoutsDto } from './dto/bulk-payouts.dto.js';

@ApiTags('Bulk Actions')
@Controller('bulk')
@UseGuards(RolesGuard)
export class BulkActionsController {
  constructor(private readonly bulkActionsService: BulkActionsService) {}

  @Post('vendor-applications')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.ADMIN)
  @RequireMembership()
  @ApiBearerAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Review multiple vendor applications in one request',
    description:
      'Bulk-approve or bulk-reject vendor profiles pending verification.',
  })
  @ApiResponse({ status: 200, description: 'Review completed.' })
  @ApiResponse({ status: 403, description: 'Only admins may review applications.' })
  @ApiResponse({ status: 409, description: 'Validation failed (e.g. non-pending profile).' })
  async reviewVendorApplications(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkVendorApplicationsDto,
  ) {
    return this.bulkActionsService.reviewVendorApplications(dto);
  }

  @Post('roles')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.ADMIN)
  @ApiBearerAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Bulk assign/change user roles',
    description: 'Assign new roles to multiple users at once. Requires admin privileges.',
  })
  @ApiResponse({ status: 200, description: 'Role changes processed.' })
  @ApiResponse({ status: 403, description: 'Only admins may modify roles.' })
  @ApiResponse({ status: 409, description: 'Validation failed.' })
  async bulkChangeRoles(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkRolesDto,
  ) {
    return this.bulkActionsService.bulkChangeRoles({
      ...dto,
      changedById: user.id,
    });
  }

  @Post('payouts')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.ADMIN)
  @RequireMembership()
  @ApiBearerAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Batch process payouts for completed orders',
    description: 'Process payouts for multiple completed orders in one request.',
  })
  @ApiResponse({ status: 200, description: 'Payouts processed.' })
  @ApiResponse({ status: 403, description: 'Only admins may process payouts.' })
  @ApiResponse({ status: 409, description: 'Validation failed (e.g. order not COMPLETED).' })
  async bulkProcessPayouts(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkPayoutsDto,
  ) {
    return this.bulkActionsService.bulkProcessPayouts(dto);
  }
}
