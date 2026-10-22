import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { RequireMembership } from '../../common/decorators/require-membership.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';

import { DraftAssignmentsService } from './draft-assignments.service.js';
import { CreateDraftAssignmentDto } from './dto/create-draft-assignment.dto.js';
import { UpdateDraftAssignmentDto } from './dto/update-draft-assignment.dto.js';
import { PublishDraftDto } from './dto/update-draft-assignment.dto.js';

@ApiTags('Assignments & Bidding')
@Controller('drafts')
@UseGuards(RolesGuard)
export class DraftAssignmentsController {
  constructor(private readonly draftsService: DraftAssignmentsService) {}

  @Get('me')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'List draft assignments owned by the current user',
    description: 'Returns all draft assignment requests, newest first.',
  })
  @ApiResponse({ status: 200, description: 'Drafts retrieved.' })
  listMyDrafts(@CurrentUser() user: AuthenticatedUser) {
    return this.draftsService.listMyDrafts(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Create or auto-save a draft assignment',
    description:
      'Creates a draft assignment request owned by the current user. Drafts are invisible to other users until published.',
  })
  @ApiResponse({ status: 201, description: 'Draft created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 409, description: 'Minimum budget exceeds maximum budget.' })
  createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDraftAssignmentDto,
  ) {
    return this.draftsService.createDraft(user.id, dto);
  }

  @Get(':id')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get a draft assignment by ID (owner only)',
  })
  @ApiParam({ name: 'id', description: 'Draft CUID' })
  @ApiResponse({ status: 200, description: 'Draft retrieved.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not the owner.' })
  @ApiResponse({ status: 404, description: 'Draft not found.' })
  getDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.draftsService.getDraft(user.id, id);
  }

  @Patch(':id')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Update a draft assignment (auto-save, owner only)',
  })
  @ApiParam({ name: 'id', description: 'Draft CUID' })
  @ApiResponse({ status: 200, description: 'Draft updated.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not the owner.' })
  @ApiResponse({ status: 404, description: 'Draft not found.' })
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDraftAssignmentDto,
  ) {
    return this.draftsService.updateDraft(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Delete a draft assignment (owner only)',
  })
  @ApiParam({ name: 'id', description: 'Draft CUID' })
  @ApiResponse({ status: 200, description: 'Draft deleted.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not the owner.' })
  @ApiResponse({ status: 404, description: 'Draft not found.' })
  deleteDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.draftsService.deleteDraft(user.id, id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CUSTOMER)
  @RequireMembership()
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Publish a draft as a real assignment (Customer + MEMBER required)',
    description:
      'Promotes a draft assignment to a real open Assignment. Requires an active MEMBER membership. The draft is archived after publishing.',
  })
  @ApiParam({ name: 'id', description: 'Draft CUID' })
  @ApiResponse({ status: 201, description: 'Draft published as assignment.' })
  @ApiResponse({ status: 402, description: 'Payment Required: an active MEMBER subscription is needed.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not the owner or insufficient role.' })
  @ApiResponse({ status: 404, description: 'Draft not found.' })
  @ApiResponse({ status: 409, description: 'Draft is not in DRAFT status.' })
  publishDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PublishDraftDto,
  ) {
    return this.draftsService.publishDraft(user.id, id, dto);
  }
}
