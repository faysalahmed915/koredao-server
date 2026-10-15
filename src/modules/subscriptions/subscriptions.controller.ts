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
} from '@nestjs/common';import {
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
import { Throttle } from '@nestjs/throttler';

import { SubscriptionsService } from './subscriptions.service.js';
import {
  CheckoutSubscriptionDto,
  SUPPORTED_SUBSCRIPTION_GATEWAYS,
  type SubscriptionGateway,
} from './dto/checkout-subscription.dto.js';
import { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto.js';

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
  // This route is unauthenticated by necessity and triggers an outbound gateway
  // verification per call, so it is throttled far below the global default.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Payment gateway redirect/callback target',
    description:
      'Reached by the browser returning from the gateway. Activates the membership only after the gateway confirms the payment server-to-server.',
  })
  @ApiParam({ name: 'gateway', enum: SUPPORTED_SUBSCRIPTION_GATEWAYS })
  async gatewayCallback(
    @Param('gateway') gateway: string,
    @Query('subscriptionId') merchantReference: string,
    @Res() res: Response,
  ) {
    const normalized = (SUPPORTED_SUBSCRIPTION_GATEWAYS as readonly string[]).includes(
      gateway,
    )
      ? (gateway as SubscriptionGateway)
      : null;

    if (!normalized || !merchantReference) {
      res.redirect(`${process.env.APP_URL || 'http://localhost:3001'}/membership?status=invalid`);
      return;
    }

    // No request-body value is used for verification: the payment is always
    // confirmed server-to-server against our stored merchant reference.
    const result = await this.subscriptionsService.handleGatewayCallback(
      normalized,
      merchantReference,
    );

    const separator = result.returnUrl.includes('?') ? '&' : '?';
    res.redirect(
      `${result.returnUrl}${separator}status=${result.activated ? 'success' : 'failed'}`,
    );
  }
}
