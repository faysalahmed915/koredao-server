import {
  Body,
  Controller,
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

import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { SubmitDeliveryDto } from './dto/submit-delivery.dto.js';
import { RequestRevisionDto } from './dto/request-revision.dto.js';
import { RaiseDisputeDto } from './dto/raise-dispute.dto.js';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto.js';
import { MockFundEscrowDto } from './dto/mock-fund-escrow.dto.js';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto.js';

@ApiTags('Orders & Escrow')
@Controller('orders')
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Initialize an order and escrow holding from a Gig or Assignment Bid',
  })
  @ApiResponse({ status: 201, description: 'Order initialized in PENDING_PAYMENT status.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(user.id, dto);
  }

  @Get('me')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get all orders involving the current user (buying or selling)',
  })
  @ApiResponse({ status: 200, description: 'User orders list retrieved.' })
  getMyOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.getMyOrders(user.id);
  }

  @Get('wallet')
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get vendor wallet balance, total earnings, and transaction history',
  })
  @ApiResponse({ status: 200, description: 'Vendor wallet info retrieved.' })
  getVendorWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.getVendorWallet(user.id);
  }

  @Post('wallet/withdraw')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Request a withdrawal payout from available wallet balance',
  })
  @ApiResponse({ status: 200, description: 'Withdrawal requested successfully.' })
  @ApiResponse({ status: 409, description: 'Insufficient wallet balance.' })
  requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.ordersService.requestWithdrawal(user.id, dto);
  }

  @Get(':id')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get full order details, timeline, and escrow status',
  })
  @ApiParam({ name: 'id', description: 'Order CUID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: not a participant.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  findById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.ordersService.findById(id, user.id);
  }

  @Post(':id/fund')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Confirm payment and lock funds in escrow (Sandbox / IPN handler)',
  })
  @ApiParam({ name: 'id', description: 'Order CUID' })
  @ApiResponse({ status: 200, description: 'Escrow funded successfully. Status updated to ESCROW_HELD.' })
  fundEscrow(
    @Param('id') id: string,
    @Body() dto: MockFundEscrowDto,
  ) {
    return this.ordersService.fundEscrow(id, dto.paymentGateway, dto.transactionRef);
  }

  @Post(':id/deliver')
  @HttpCode(HttpStatus.OK)
  @MinRole(UserRole.VENDOR)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Submit final completed deliverables and start 72-hour auto-release timer',
    description: 'Requires funded escrow. Cannot submit without confirmed payment.',
  })
  @ApiParam({ name: 'id', description: 'Order CUID' })
  @ApiResponse({ status: 200, description: 'Deliverables submitted. Status updated to DELIVERED.' })
  @ApiResponse({ status: 409, description: 'Escrow not funded.' })
  submitDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitDeliveryDto,
  ) {
    return this.ordersService.submitDelivery(user.id, id, dto);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Accept delivered work and release escrow funds to helper wallet (Customer action)',
  })
  @ApiParam({ name: 'id', description: 'Order CUID' })
  @ApiResponse({ status: 200, description: 'Order completed. Net funds (90%) credited to helper wallet.' })
  acceptDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.ordersService.acceptDelivery(user.id, id);
  }

  @Post(':id/revision')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Request revisions on delivered work (within max revisions limit)',
  })
  @ApiParam({ name: 'id', description: 'Order CUID' })
  @ApiResponse({ status: 200, description: 'Revision requested. Order reset to IN_PROGRESS.' })
  @ApiResponse({ status: 409, description: 'Revision limit reached.' })
  requestRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RequestRevisionDto,
  ) {
    return this.ordersService.requestRevision(user.id, id, dto);
  }

  @Post(':id/dispute')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Raise a dispute on an active order for moderation arbitration',
  })
  @ApiParam({ name: 'id', description: 'Order CUID' })
  @ApiResponse({ status: 200, description: 'Dispute raised. Timers paused.' })
  raiseDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RaiseDisputeDto,
  ) {
    return this.ordersService.raiseDispute(user.id, id, dto);
  }

  @Post(':id/resolve-dispute')
  @MinRole(UserRole.ADMIN)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Resolve order dispute with fund release or refund (Admin/Moderator only)',
  })
  @ApiParam({ name: 'id', description: 'Order CUID' })
  @ApiResponse({ status: 200, description: 'Dispute resolved.' })
  resolveDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.ordersService.resolveDispute(user.id, id, dto);
  }

  @Post('cron/auto-release')
  @MinRole(UserRole.ADMIN)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Trigger 72-hour auto-release worker manually or via cron webhook',
  })
  @ApiResponse({ status: 200, description: 'Expired orders auto-released to helpers.' })
  triggerAutoRelease() {
    return this.ordersService.process72HourAutoReleases();
  }
}
