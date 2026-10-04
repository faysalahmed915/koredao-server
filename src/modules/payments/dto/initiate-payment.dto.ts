import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export enum PaymentGateway {
  AAMARPAY = 'AAMARPAY',
  PIPRAPAY = 'PIPRAPAY',
  MOCK_SANDBOX = 'MOCK_SANDBOX',
}

export class InitiatePaymentDto {
  @ApiProperty({
    example: 'clxyz1234567890',
    description: 'Order CUID to fund in escrow',
  })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({
    enum: PaymentGateway,
    example: PaymentGateway.AAMARPAY,
    description: 'Payment Gateway channel chosen by customer',
  })
  @IsEnum(PaymentGateway)
  gateway!: PaymentGateway;

  @ApiProperty({
    example: 'http://localhost:3001/orders/clxyz1234567890',
    description: 'Client redirect URL after payment completion',
    required: false,
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  clientReturnUrl?: string;
}
