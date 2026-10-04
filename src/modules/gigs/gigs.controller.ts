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

import { GigsService } from './gigs.service.js';
import { CreateGigDto } from './dto/create-gig.dto.js';
import { UpdateGigDto } from './dto/update-gig.dto.js';
import { QueryGigsDto } from './dto/query-gigs.dto.js';

@ApiTags('Gigs & Services')
@Controller('gigs')
@UseGuards(RolesGuard)
export class GigsController {
  constructor(private readonly gigsService: GigsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Publish a new academic service gig (Verified Helpers only)',
    description: 'Creates a gig with single or 3-tier packages (Basic, Standard, Premium). Requires approved VENDOR role.',
  })
  @ApiResponse({ status: 201, description: 'Gig created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 403, description: 'Forbidden: caller is not an approved helper.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGigDto,
  ) {
    return this.gigsService.create(user.id, dto);
  }

  @Public()
  @Get('search')
  @ApiOperation({
    summary: 'Search & filter active gigs in marketplace',
    description: 'Filter by category, custom subject tags, university, hardcopy requirements, and price range.',
  })
  @ApiResponse({ status: 200, description: 'Gigs search results.' })
  search(@Query() query: QueryGigsDto) {
    return this.gigsService.search(query);
  }

  @Get('me')
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get all gigs created by authenticated vendor',
  })
  @ApiResponse({ status: 200, description: 'Vendor gigs retrieved.' })
  getMyGigs(@CurrentUser() user: AuthenticatedUser) {
    return this.gigsService.getMyGigs(user.id);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'Get gig details by unique slug',
    description: 'Returns package tiers, demo attachments, and helper profile information.',
  })
  @ApiParam({ name: 'slug', description: 'Gig SEO slug or ID' })
  @ApiResponse({ status: 200, description: 'Gig details retrieved.' })
  @ApiResponse({ status: 404, description: 'Gig not found or inactive.' })
  findBySlug(@Param('slug') slug: string) {
    return this.gigsService.findBySlug(slug);
  }

  @Patch(':id')
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Update an existing gig',
  })
  @ApiParam({ name: 'id', description: 'Gig CUID' })
  @ApiResponse({ status: 200, description: 'Gig updated successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not the owner.' })
  @ApiResponse({ status: 404, description: 'Gig not found.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGigDto,
  ) {
    return this.gigsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Delete a gig owned by current vendor',
  })
  @ApiParam({ name: 'id', description: 'Gig CUID' })
  @ApiResponse({ status: 200, description: 'Gig deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not the owner.' })
  @ApiResponse({ status: 404, description: 'Gig not found.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.gigsService.remove(user.id, id);
  }
}
