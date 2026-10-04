import {
  Body,
  Controller,
  Delete,
  Get,
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
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { MinRole } from '../../common/decorators/min-role.decorator.js';
import { AllowSelf } from '../../common/decorators/allow-self.decorator.js';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@ApiCookieAuth('better-auth.session_token')
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @MinRole(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new user (admin / management)',
    description: 'Requires ADMIN or SUPER_ADMIN role. Only SUPER_ADMIN can create other SUPER_ADMIN users.',
  })
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient privileges.' })
  @ApiResponse({ status: 409, description: 'User already exists.' })
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.create(createUserDto, currentUser);
  }

  @Get()
  @MinRole(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get paginated list of users',
    description: 'Requires ADMIN or SUPER_ADMIN role. Supports pagination, search by name/email, and filtering by role.',
  })
  @ApiResponse({ status: 200, description: 'Users list retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient privileges.' })
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get full profile of current authenticated user',
    description: 'Returns user info along with active sessions and linked accounts. Accessible to any authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Get(':id')
  @MinRole(UserRole.ADMIN)
  @AllowSelf('id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Accessible by the user themselves (self-service) or users with ADMIN/SUPER_ADMIN role.',
  })
  @ApiParam({ name: 'id', description: 'User CUID / ID string' })
  @ApiResponse({ status: 200, description: 'User found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient privileges.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @MinRole(UserRole.ADMIN)
  @AllowSelf('id')
  @ApiOperation({
    summary: 'Update user by ID',
    description: 'Self-service updates allowed for own profile (without role modification). Role assignment and managing other users requires administrative privileges.',
  })
  @ApiParam({ name: 'id', description: 'User CUID / ID string' })
  @ApiResponse({ status: 200, description: 'User updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient privileges.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 409, description: 'Email conflict.' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Delete(':id')
  @MinRole(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete user by ID',
    description: 'Requires ADMIN or SUPER_ADMIN role. Prevents self-deletion and prevents standard administrators from deleting super administrators.',
  })
  @ApiParam({ name: 'id', description: 'User CUID / ID string' })
  @ApiResponse({ status: 200, description: 'User deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient privileges.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.remove(id, currentUser);
  }
}
