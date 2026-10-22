import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class BulkPayoutItemDto {
  @ApiProperty({
    description: 'Order ID to payout (must be completed and earned)',
    example: 'order-456',
  })
  @IsUUID()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({
    description: 'Payment method for the batch payout (e.g. bKash, Nagad, bank)',
    example: 'bKash',
  })
  @IsString()
  @IsNotEmpty()
  method!: string;

  @ApiProperty({
    description: 'Total amount to payout in BDT for this order',
    example: 1200,
    minimum: 100,
  })
  @IsNumber()
  @Min(100)
  @IsNotEmpty()
  amount!: number;

  @ApiPropertyOptional({
    description: 'Payment reference / invoice id for the gateway',
    example: 'BATCH-20261023-001',
  })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class BulkPayoutsDto {
  @ApiProperty({
    description: 'List of payouts to process in batch',
    type: [BulkPayoutItemDto],
  })
  @IsArray()
  @IsNotEmpty()
  items!: BulkPayoutItemDto[];
}
