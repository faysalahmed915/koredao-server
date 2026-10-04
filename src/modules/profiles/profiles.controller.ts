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

import { ProfilesService } from './profiles.service.js';
import { CreateVendorApplicationDto } from './dto/create-vendor-application.dto.js';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto.js';
import { ReviewVendorApplicationDto } from './dto/review-vendor-application.dto.js';
import { AddHandwritingSampleDto } from './dto/add-handwriting-sample.dto.js';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto.js';
import { QueryVendorsDto } from './dto/query-vendors.dto.js';

@ApiTags('Profiles & Verification')
@Controller('profiles')
@UseGuards(RolesGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  // ---------------------------------------------------------------------------
  // VENDOR APPLICATION & SELF-SERVICE
  // ---------------------------------------------------------------------------

  @Post('vendor/apply')
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Submit vendor application with academic credentials and handwriting sample',
    description: 'Creates a pending vendor profile for review by the platform administration team.',
  })
  @ApiResponse({ status: 201, description: 'Application submitted successfully.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 409, description: 'Application already pending or approved.' })
  applyAsVendor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVendorApplicationDto,
  ) {
    return this.profilesService.applyAsVendor(user.id, dto);
  }

  @Get('vendor/me')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get vendor profile of authenticated user',
    description: 'Returns profile details, verification status, and uploaded handwriting samples.',
  })
  @ApiResponse({ status: 200, description: 'Vendor profile retrieved.' })
  getMyVendorProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getMyVendorProfile(user.id);
  }

  @Patch('vendor/me')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Update vendor profile info (bio, skills, degree, passing year)',
  })
  @ApiResponse({ status: 200, description: 'Vendor profile updated.' })
  @ApiResponse({ status: 404, description: 'Vendor profile not found.' })
  updateMyVendorProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVendorProfileDto,
  ) {
    return this.profilesService.updateMyVendorProfile(user.id, dto);
  }

  @Post('vendor/me/samples')
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Add a new handwriting sample to vendor profile',
  })
  @ApiResponse({ status: 201, description: 'Handwriting sample added.' })
  @ApiResponse({ status: 404, description: 'Vendor profile not found.' })
  addHandwritingSample(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddHandwritingSampleDto,
  ) {
    return this.profilesService.addHandwritingSample(user.id, dto);
  }

  @Delete('vendor/me/samples/:sampleId')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Delete a handwriting sample owned by current vendor',
  })
  @ApiParam({ name: 'sampleId', description: 'Sample ID string' })
  @ApiResponse({ status: 200, description: 'Sample deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: sample not owned by caller.' })
  @ApiResponse({ status: 404, description: 'Sample not found.' })
  removeHandwritingSample(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sampleId') sampleId: string,
  ) {
    return this.profilesService.removeHandwritingSample(user.id, sampleId);
  }

  // ---------------------------------------------------------------------------
  // ADMIN VERIFICATION WORKFLOW
  // ---------------------------------------------------------------------------

  @Get('admin/pending')
  @MinRole(UserRole.ADMIN)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get pending vendor applications for review (Admin/Moderator)',
    description: 'Requires ADMIN or SUPER_ADMIN role.',
  })
  @ApiResponse({ status: 200, description: 'Pending applications retrieved.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient privileges.' })
  getPendingApplications(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.profilesService.getPendingApplications(page, limit);
  }

  @Post('admin/review/:profileId')
  @MinRole(UserRole.ADMIN)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Approve or reject a vendor application',
    description: 'Requires ADMIN or SUPER_ADMIN role. On approval, user role elevates to VENDOR.',
  })
  @ApiParam({ name: 'profileId', description: 'VendorProfile CUID' })
  @ApiResponse({ status: 200, description: 'Application reviewed successfully.' })
  @ApiResponse({ status: 404, description: 'Application not found.' })
  reviewVendorApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('profileId') profileId: string,
    @Body() dto: ReviewVendorApplicationDto,
  ) {
    return this.profilesService.reviewVendorApplication(user.id, profileId, dto);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC VENDOR SEARCH & DISCOVERY
  // ---------------------------------------------------------------------------

  @Public()
  @Get('vendor/search')
  @ApiOperation({
    summary: 'Public directory search for verified vendors',
    description: 'Filter by university, department, handwriting style, or search terms.',
  })
  @ApiResponse({ status: 200, description: 'Vendors search results.' })
  searchVendors(@Query() query: QueryVendorsDto) {
    return this.profilesService.searchVendors(query);
  }

  @Public()
  @Get('vendor/:id')
  @ApiOperation({
    summary: 'Get public vendor profile by ID',
    description: 'Returns safe public profile including academic credentials and verified handwriting samples.',
  })
  @ApiParam({ name: 'id', description: 'VendorProfile ID' })
  @ApiResponse({ status: 200, description: 'Public vendor profile.' })
  @ApiResponse({ status: 404, description: 'Vendor not found or unapproved.' })
  getPublicVendorProfile(@Param('id') id: string) {
    return this.profilesService.getPublicVendorProfile(id);
  }

  // ---------------------------------------------------------------------------
  // CUSTOMER PROFILE
  // ---------------------------------------------------------------------------

  @Get('customer/me')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get current user customer profile',
  })
  @ApiResponse({ status: 200, description: 'Customer profile retrieved.' })
  getMyCustomerProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getMyCustomerProfile(user.id);
  }

  @Patch('customer/me')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Update current user customer profile',
  })
  @ApiResponse({ status: 200, description: 'Customer profile updated.' })
  updateMyCustomerProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.profilesService.updateMyCustomerProfile(user.id, dto);
  }
}
