import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { PaymentsService } from './payments.service.js';
import { InitiatePaymentDto } from './dto/initiate-payment.dto.js';
import { VerifyPaymentDto } from './dto/verify-payment.dto.js';

@ApiTags('Payments & Gateways')
@Controller('payments')
@UseGuards(RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Initiate payment session with Aamarpay, PipraPay, or Sandbox simulator',
  })
  @ApiResponse({ status: 200, description: 'Payment session created. Returns redirect paymentUrl.' })
  initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiatePayment(user.id, dto);
  }

  @Post('aamarpay/callback')
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({
    summary: 'Aamarpay return/IPN callback (POST)',
  })
  async aamarpayCallbackPost(
    @Query('orderId') orderId: string,
    @Query('returnUrl') returnUrl: string,
    @Body() body: Record<string, any>,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.paymentsService.handleAamarpayCallback(
      body,
      orderId,
      returnUrl,
    );
    return res.redirect(redirectUrl);
  }

  @Get('aamarpay/callback')
  @ApiOperation({
    summary: 'Aamarpay return/IPN callback (GET)',
  })
  async aamarpayCallbackGet(
    @Query('orderId') orderId: string,
    @Query('returnUrl') returnUrl: string,
    @Query() query: Record<string, any>,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.paymentsService.handleAamarpayCallback(
      query,
      orderId,
      returnUrl,
    );
    return res.redirect(redirectUrl);
  }

  @Post('piprapay/ipn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'PipraPay Instant Payment Notification (IPN) webhook',
  })
  async piprapayIpn(
    @Query('orderId') orderId: string,
    @Query('returnUrl') returnUrl: string,
    @Body() body: Record<string, any>,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.paymentsService.handlePiprapayIpn(
      body,
      orderId,
      returnUrl,
    );
    if (res.req.headers['content-type']?.includes('application/json')) {
      return res.json({ success: true, message: 'IPN processed' });
    }
    return res.redirect(redirectUrl);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('better-auth.session_token')
  @ApiOperation({
    summary: 'Verify payment state of an order',
  })
  @ApiResponse({ status: 200, description: 'Order payment status verified.' })
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(user.id, dto);
  }
}
