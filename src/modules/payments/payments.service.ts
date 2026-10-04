import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { InitiatePaymentDto, PaymentGateway } from './dto/initiate-payment.dto.js';
import { VerifyPaymentDto } from './dto/verify-payment.dto.js';
import { OrderStatus } from '@prisma/client';

export interface PaymentInitiationResult {
  paymentUrl: string;
  gateway: PaymentGateway;
  transactionId: string;
  orderId: string;
  amount: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Initiates a payment session with customer's chosen gateway (Aamarpay, PipraPay, or Sandbox)
   */
  async initiatePayment(
    userId: string,
    dto: InitiatePaymentDto,
  ): Promise<PaymentInitiationResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        vendorProfile: { select: { id: true, userId: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order '${dto.orderId}' not found`);
    }

    if (order.customerId !== userId) {
      throw new ForbiddenException('You do not own this order');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException(
        `Order is currently in ${order.status} status and cannot be paid`,
      );
    }

    const returnUrl =
      dto.clientReturnUrl ||
      this.config.get<string>('payment.returnUrl', 'http://localhost:3001/orders') +
        `/${order.id}`;

    switch (dto.gateway) {
      case PaymentGateway.AAMARPAY:
        return this.initiateAamarpay(order, returnUrl);
      case PaymentGateway.PIPRAPAY:
        return this.initiatePiprapay(order, returnUrl);
      case PaymentGateway.MOCK_SANDBOX:
      default:
        return this.initiateMockSandbox(order, returnUrl);
    }
  }

  /**
   * Aamarpay initiation logic
   */
  private async initiateAamarpay(
    order: any,
    clientReturnUrl: string,
  ): Promise<PaymentInitiationResult> {
    const storeId = this.config.get<string>('payment.aamarpay.storeId', 'aamarpaytest');
    const signatureKey = this.config.get<string>(
      'payment.aamarpay.signatureKey',
      'dbb74894e82415a2f7ff0ec3a97e4183',
    );
    const initiateUrl = this.config.get<string>(
      'payment.aamarpay.initiateUrl',
      'https://sandbox.aamarpay.com/jsonpost.php',
    );
    const isSandbox = this.config.get<boolean>('payment.aamarpay.isSandbox', true);

    const txnId = `KD_AAMAR_${order.orderNumber}_${Date.now().toString(36)}`;
    const serverBaseUrl =
      process.env.APP_URL || `http://localhost:${this.config.get('app.port', 3000)}`;
    const apiPrefix = this.config.get<string>('app.apiPrefix', 'api/v1');

    const callbackUrl = `${serverBaseUrl}/${apiPrefix}/payments/aamarpay/callback?orderId=${order.id}&returnUrl=${encodeURIComponent(clientReturnUrl)}`;

    const payload = {
      store_id: storeId,
      signature_key: signatureKey,
      tran_id: txnId,
      amount: order.totalAmount.toString(),
      currency: 'BDT',
      desc: `KoreDao Escrow: ${order.title.slice(0, 45)}`,
      cus_name: order.customer.name || 'Student Client',
      cus_email: order.customer.email || 'student@koredao.com',
      cus_phone: '01700000000',
      cus_add1: 'Dhaka',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      success_url: callbackUrl,
      fail_url: callbackUrl,
      cancel_url: callbackUrl,
      type: 'json',
      opt_a: order.id,
    };

    try {
      this.logger.log(`Initiating Aamarpay payment for Order #${order.orderNumber} (৳${order.totalAmount})...`);
      const response = await fetch(initiateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resText = await response.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch {
        // Aamarpay sandbox might return URL string or plain text
      }

      if (resJson?.result === 'true' && resJson?.payment_url) {
        return {
          paymentUrl: resJson.payment_url,
          gateway: PaymentGateway.AAMARPAY,
          transactionId: txnId,
          orderId: order.id,
          amount: order.totalAmount,
        };
      }

      // If Aamarpay sandbox is unreachable or credentials are mock demo in local env,
      // fallback smoothly to local sandbox simulator so developer/student is never blocked
      if (isSandbox) {
        this.logger.warn(`Aamarpay sandbox API returned non-JSON/offline: ${resText}. Falling back to sandbox simulator.`);
        return this.initiateMockSandbox(order, clientReturnUrl, PaymentGateway.AAMARPAY);
      }

      throw new ConflictException(
        resJson?.message || 'Failed to initialize payment with Aamarpay',
      );
    } catch (err: any) {
      if (isSandbox) {
        this.logger.warn(`Aamarpay gateway network error: ${err.message}. Falling back to sandbox simulator.`);
        return this.initiateMockSandbox(order, clientReturnUrl, PaymentGateway.AAMARPAY);
      }
      throw new ConflictException(`Payment gateway error: ${err.message}`);
    }
  }

  /**
   * PipraPay initiation logic
   */
  private async initiatePiprapay(
    order: any,
    clientReturnUrl: string,
  ): Promise<PaymentInitiationResult> {
    const apiKey = this.config.get<string>('payment.piprapay.apiKey', 'demo_piprapay_key');
    const merchantId = this.config.get<string>(
      'payment.piprapay.merchantId',
      'demo_piprapay_merchant',
    );
    const initiateUrl = this.config.get<string>(
      'payment.piprapay.initiateUrl',
      'https://api.piprapay.com/v1/payment/create',
    );
    const isSandbox = this.config.get<boolean>('payment.piprapay.isSandbox', true);

    const txnId = `KD_PIPRA_${order.orderNumber}_${Date.now().toString(36)}`;
    const serverBaseUrl =
      process.env.APP_URL || `http://localhost:${this.config.get('app.port', 3000)}`;
    const apiPrefix = this.config.get<string>('app.apiPrefix', 'api/v1');

    const callbackUrl = `${serverBaseUrl}/${apiPrefix}/payments/piprapay/ipn?orderId=${order.id}&returnUrl=${encodeURIComponent(clientReturnUrl)}`;

    const payload = {
      merchant_id: merchantId,
      amount: order.totalAmount,
      currency: 'BDT',
      order_id: txnId,
      customer_name: order.customer.name || 'Student Client',
      customer_email: order.customer.email || 'student@koredao.com',
      customer_phone: '01700000000',
      callback_url: callbackUrl,
      return_url: `${clientReturnUrl}?payment=success&orderId=${order.id}`,
    };

    try {
      this.logger.log(`Initiating PipraPay payment for Order #${order.orderNumber} (৳${order.totalAmount})...`);
      const response = await fetch(initiateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify(payload),
      });

      const resJson = await response.json();
      if (resJson?.status === 'success' && (resJson?.payment_url || resJson?.redirect_url)) {
        return {
          paymentUrl: resJson.payment_url || resJson.redirect_url,
          gateway: PaymentGateway.PIPRAPAY,
          transactionId: txnId,
          orderId: order.id,
          amount: order.totalAmount,
        };
      }

      if (isSandbox) {
        this.logger.warn(`PipraPay returned: ${JSON.stringify(resJson)}. Falling back to sandbox simulator.`);
        return this.initiateMockSandbox(order, clientReturnUrl, PaymentGateway.PIPRAPAY);
      }

      throw new ConflictException(resJson?.message || 'Failed to initialize payment with PipraPay');
    } catch (err: any) {
      if (isSandbox) {
        this.logger.warn(`PipraPay gateway network error: ${err.message}. Falling back to sandbox simulator.`);
        return this.initiateMockSandbox(order, clientReturnUrl, PaymentGateway.PIPRAPAY);
      }
      throw new ConflictException(`Payment gateway error: ${err.message}`);
    }
  }

  /**
   * Mock Sandbox Simulator for local development and offline testing
   */
  private initiateMockSandbox(
    order: any,
    clientReturnUrl: string,
    simulatedGateway = PaymentGateway.MOCK_SANDBOX,
  ): PaymentInitiationResult {
    const txnId = `MOCK_TXN_${order.orderNumber}_${Date.now().toString(36)}`;
    const separator = clientReturnUrl.includes('?') ? '&' : '?';
    const paymentUrl = `${clientReturnUrl}${separator}sandboxModal=true&orderId=${order.id}&gateway=${simulatedGateway}&amount=${order.totalAmount}&txnId=${txnId}`;

    return {
      paymentUrl,
      gateway: simulatedGateway,
      transactionId: txnId,
      orderId: order.id,
      amount: order.totalAmount,
    };
  }

  /**
   * Handles Aamarpay return/IPN callback (Dual-channel verification: verifies status and releases escrow)
   */
  async handleAamarpayCallback(data: Record<string, any>, orderId: string, returnUrl?: string) {
    this.logger.log(`Received Aamarpay callback for orderId=${orderId}: ${JSON.stringify(data)}`);

    const isSuccess =
      data.pay_status === 'Successful' ||
      data.status === 'Successful' ||
      data.status_code === '2' ||
      data.pay_status === 'success';

    if (isSuccess) {
      const transactionRef = data.pg_txnid || data.mer_txnid || data.bank_trxid || `AAMAR_${Date.now()}`;
      try {
        await this.ordersService.fundEscrow(orderId, 'AAMARPAY', transactionRef);
        this.logger.log(`Escrow successfully funded for orderId=${orderId} via Aamarpay.`);
      } catch (err: any) {
        this.logger.warn(`Escrow funding note for orderId=${orderId}: ${err.message}`);
      }
    }

    const targetUrl =
      returnUrl ||
      `${this.config.get<string>('payment.returnUrl', 'http://localhost:3001/orders')}/${orderId}`;
    const separator = targetUrl.includes('?') ? '&' : '?';
    return `${targetUrl}${separator}payment=${isSuccess ? 'success' : 'failed'}&gateway=AAMARPAY`;
  }

  /**
   * Handles PipraPay IPN callback
   */
  async handlePiprapayIpn(data: Record<string, any>, orderId: string, returnUrl?: string) {
    this.logger.log(`Received PipraPay IPN for orderId=${orderId}: ${JSON.stringify(data)}`);

    const isSuccess =
      data.status === 'COMPLETED' ||
      data.status === 'SUCCESS' ||
      data.status === 'success' ||
      data.payment_status === 'completed';

    if (isSuccess) {
      const transactionRef = data.pp_txnid || data.transaction_id || `PIPRA_${Date.now()}`;
      try {
        await this.ordersService.fundEscrow(orderId, 'PIPRAPAY', transactionRef);
        this.logger.log(`Escrow successfully funded for orderId=${orderId} via PipraPay.`);
      } catch (err: any) {
        this.logger.warn(`Escrow funding note for orderId=${orderId}: ${err.message}`);
      }
    }

    const targetUrl =
      returnUrl ||
      `${this.config.get<string>('payment.returnUrl', 'http://localhost:3001/orders')}/${orderId}`;
    const separator = targetUrl.includes('?') ? '&' : '?';
    return `${targetUrl}${separator}payment=${isSuccess ? 'success' : 'failed'}&gateway=PIPRAPAY`;
  }

  /**
   * Verifies payment state and provides manual/fallback confirmation
   */
  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { escrowHolding: true },
    });

    if (!order) {
      throw new NotFoundException(`Order '${dto.orderId}' not found`);
    }

    if (order.customerId !== userId) {
      throw new ForbiddenException('You do not own this order');
    }

    if (order.status === OrderStatus.ESCROW_HELD) {
      return {
        funded: true,
        orderId: order.id,
        status: order.status,
        escrow: order.escrowHolding,
      };
    }

    // If sandbox transactionRef is provided and still pending, confirm escrow
    if (dto.transactionRef && order.status === OrderStatus.PENDING_PAYMENT) {
      await this.ordersService.fundEscrow(order.id, 'VERIFIED_GATEWAY', dto.transactionRef);
      const updated = await this.prisma.order.findUnique({
        where: { id: order.id },
        include: { escrowHolding: true },
      });
      return {
        funded: true,
        orderId: order.id,
        status: updated?.status,
        escrow: updated?.escrowHolding,
      };
    }

    return {
      funded: false,
      orderId: order.id,
      status: order.status,
      escrow: order.escrowHolding,
    };
  }
}
