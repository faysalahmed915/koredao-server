import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @ApiProperty({
    example: 'clxyz1234567890',
    description: 'Order CUID to verify',
  })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({
    example: 'AAMARPAY_TRX_992144',
    description: 'Transaction ID or Reference provided by gateway',
    required: false,
  })
  @IsOptional()
  @IsString()
  transactionRef?: string;
}
