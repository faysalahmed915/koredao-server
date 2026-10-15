import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

import { SubscriptionsService } from './subscriptions.service.js';
import { CheckoutSubscriptionDto } from './dto/checkout-subscription.dto.js';
import type { SubscriptionGateway } from './dto/checkout-subscription.dto.js';
import { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto.js';

const SUPPORTED_CALLBACK_GATEWAYS: SubscriptionGateway[] = [
  'aamarpay',
  'piprapay',
  'sandbox',
];

@ApiTags('Memberships & Subscriptions')
@Controller('subscriptions')
@UseGuards(RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  @ApiOperation({
    summary: 'List purchasable membership plans (public pricing table)',
  })
  @ApiResponse({ status: 200, description: 'Membership plans retrieved.' })
  getPlans() {
    return { plans: this.subscriptionsService.listPlans() };
  }

  @Get('me')
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Get the current user’s membership state',
    description:
      'Reports whether the caller currently holds the subscription-backed MEMBER role, plus plan and expiry details.',
  })
  @ApiResponse({ status: 200, description: 'Membership state retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getMyMembership(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getMyMembership(user.id);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Start a membership purchase',
    description:
      'Creates a PENDING subscription and, for real gateways, returns the hosted checkout URL. Membership is NOT granted until the payment is verified server-side.',
  })
  @ApiResponse({ status: 201, description: 'Checkout session created.' })
  @ApiResponse({ status: 409, description: 'A membership is already active.' })
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutSubscriptionDto,
  ) {
    return this.subscriptionsService.checkout(user.id, dto);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Confirm a membership purchase after gateway payment',
    description:
      'Verifies the payment directly with the gateway before activating the membership. Idempotent.',
  })
  @ApiResponse({ status: 200, description: 'Membership activated.' })
  @ApiResponse({ status: 403, description: 'Forbidden: subscription belongs to another user.' })
  @ApiResponse({ status: 409, description: 'Gateway could not verify the payment.' })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmSubscriptionDto,
  ) {
    return this.subscriptionsService.confirm(user.id, dto);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Cancel auto-renewal of the current membership',
    description: 'Access is retained until the already-paid period ends.',
  })
  @ApiResponse({ status: 200, description: 'Membership cancellation recorded.' })
  cancel(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.cancelMine(user.id);
  }

  @Public()
  @Post(':gateway/callback')
  @ApiOperation({
    summary: 'Payment gateway redirect/callback target',
    description:
      'Reached by the browser returning from the gateway. Activates the membership only after the gateway confirms the payment server-to-server.',
  })
  @ApiParam({ name: 'gateway', enum: SUPPORTED_CALLBACK_GATEWAYS })
  async gatewayCallback(
    @Param('gateway') gateway: string,
    @Query('subscriptionId') subscriptionId: string,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const normalized = (SUPPORTED_CALLBACK_GATEWAYS as string[]).includes(gateway)
      ? (gateway as SubscriptionGateway)
      : null;

    if (!normalized || !subscriptionId) {
      res.redirect(`${process.env.APP_URL || 'http://localhost:3001'}/membership?status=invalid`);
      return;
    }

    const reference =
      (body?.pg_txnid as string) ||
      (body?.mer_txnid as string) ||
      (body?.bank_trxid as string) ||
      (body?.pp_txnid as string) ||
      (body?.transaction_id as string) ||
      undefined;

    const result = await this.subscriptionsService.handleGatewayCallback(
      normalized,
      subscriptionId,
      reference,
    );

    const separator = result.returnUrl.includes('?') ? '&' : '?';
    res.redirect(
      `${result.returnUrl}${separator}status=${result.activated ? 'success' : 'failed'}`,
    );
  }
}
