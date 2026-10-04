import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { MinRole } from '../../common/decorators/min-role.decorator.js';
import { UserRole } from '@prisma/client';
import { MilestonesService } from './milestones.service.js';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto.js';
import { SubmitCheckpointProgressDto } from './dto/submit-checkpoint-progress.dto.js';
import { ReviewCheckpointDto } from './dto/review-checkpoint.dto.js';

@ApiTags('Milestones & Checkpoints')
@Controller('milestones')
@UseGuards(RolesGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Define a new project milestone checkpoint (Helper only)',
  })
  @ApiResponse({ status: 201, description: 'Checkpoint created successfully.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckpointDto,
  ) {
    return this.milestonesService.createCheckpoint(user.id, dto);
  }

  @Get('order/:orderId')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get all milestone checkpoints for an order',
  })
  @ApiParam({ name: 'orderId', description: 'Order CUID' })
  @ApiResponse({ status: 200, description: 'Milestones retrieved successfully.' })
  getOrderCheckpoints(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    return this.milestonesService.getOrderCheckpoints(user.id, orderId);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Submit progress draft, handwriting proof photos, or courier tracking for a milestone',
  })
  @ApiParam({ name: 'id', description: 'Checkpoint CUID' })
  @ApiResponse({ status: 200, description: 'Milestone progress submitted.' })
  submitProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitCheckpointProgressDto,
  ) {
    return this.milestonesService.submitProgress(user.id, id, dto);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Client reviews submitted milestone progress (Accept or Request Revision)',
  })
  @ApiParam({ name: 'id', description: 'Checkpoint CUID' })
  @ApiResponse({ status: 200, description: 'Milestone reviewed.' })
  reviewCheckpoint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewCheckpointDto,
  ) {
    return this.milestonesService.reviewCheckpoint(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Helper deletes a pending milestone checkpoint',
  })
  @ApiParam({ name: 'id', description: 'Checkpoint CUID' })
  @ApiResponse({ status: 200, description: 'Milestone deleted.' })
  deleteCheckpoint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.milestonesService.deleteCheckpoint(user.id, id);
  }
}
