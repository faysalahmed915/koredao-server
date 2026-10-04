import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { Public } from '../../common/decorators/public.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { MinRole } from '../../common/decorators/min-role.decorator.js';
import { UserRole } from '@prisma/client';

import { AssignmentsService } from './assignments.service.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { UpdateAssignmentDto } from './dto/update-assignment.dto.js';
import { CreateBidDto } from './dto/create-bid.dto.js';
import { QueryAssignmentsDto } from './dto/query-assignments.dto.js';

@ApiTags('Assignments & Bidding')
@Controller('assignments')
@UseGuards(RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Post a new assignment / project request (Upwork model)',
    description: 'Creates an open academic request that verified helpers can bid on.',
  })
  @ApiResponse({ status: 201, description: 'Assignment posted successfully.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignmentsService.create(user.id, dto);
  }

  @Public()
  @Get('search')
  @ApiOperation({
    summary: 'Search & browse open assignment posts',
    description: 'Filter by category, deliverable type (softcopy/hardcopy), subject, budget, or university campus.',
  })
  @ApiResponse({ status: 200, description: 'Assignments search results.' })
  search(@Query() query: QueryAssignmentsDto) {
    return this.assignmentsService.search(query);
  }

  @Get('me')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get all assignment requests posted by the current user',
  })
  @ApiResponse({ status: 200, description: 'User assignments retrieved.' })
  getMyAssignments(@CurrentUser() user: AuthenticatedUser) {
    return this.assignmentsService.getMyAssignments(user.id);
  }

  @Get('bids/me')
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get all proposals/bids submitted by the current helper',
  })
  @ApiResponse({ status: 200, description: 'Vendor bids retrieved.' })
  getMyBids(@CurrentUser() user: AuthenticatedUser) {
    return this.assignmentsService.getMyBids(user.id);
  }

  @Get(':id')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get assignment details and proposals',
    description: 'Reveals all proposals to the owner; shows only own proposal to bidding helpers.',
  })
  @ApiParam({ name: 'id', description: 'Assignment CUID' })
  @ApiResponse({ status: 200, description: 'Assignment retrieved.' })
  @ApiResponse({ status: 404, description: 'Assignment not found.' })
  findById(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.assignmentsService.findById(id, user?.id);
  }

  @Patch(':id')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Update assignment request details',
  })
  @ApiParam({ name: 'id', description: 'Assignment CUID' })
  @ApiResponse({ status: 200, description: 'Assignment updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not the owner.' })
  @ApiResponse({ status: 404, description: 'Assignment not found.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignmentsService.update(user.id, id, dto);
  }

  @Post(':id/bids')
  @HttpCode(HttpStatus.CREATED)
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Submit a proposal / bid on an open assignment (Verified Helpers only)',
  })
  @ApiParam({ name: 'id', description: 'Assignment CUID' })
  @ApiResponse({ status: 201, description: 'Bid submitted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is not an approved helper.' })
  @ApiResponse({ status: 409, description: 'Assignment closed or bidding self.' })
  submitBid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateBidDto,
  ) {
    return this.assignmentsService.submitBid(user.id, id, dto);
  }

  @Post(':id/bids/:bidId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Accept helper proposal and hire (Customer action)',
    description: 'Marks the chosen proposal as ACCEPTED and other proposals as REJECTED. Transitions assignment to ASSIGNED.',
  })
  @ApiParam({ name: 'id', description: 'Assignment CUID' })
  @ApiParam({ name: 'bidId', description: 'Bid CUID' })
  @ApiResponse({ status: 200, description: 'Proposal accepted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not the assignment owner.' })
  @ApiResponse({ status: 404, description: 'Proposal or assignment not found.' })
  acceptBid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('bidId') bidId: string,
  ) {
    return this.assignmentsService.acceptBid(user.id, id, bidId);
  }
}
