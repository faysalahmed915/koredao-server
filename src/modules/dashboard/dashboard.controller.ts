import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service.js';

@ApiTags('Role-Based Dashboard')
@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary:
      'Get personalized role-based dashboard metrics for authenticated user (Customer, Vendor, or Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Personalized role-based dashboard data retrieved.',
  })
  getMetrics(@CurrentUser() user: AuthenticatedUser) {
    const role = (user.role as UserRole) || UserRole.CUSTOMER;
    return this.dashboardService.getMetrics(user.id, role);
  }
}
