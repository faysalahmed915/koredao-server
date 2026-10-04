import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateOrGetConversationDto {
  @ApiProperty({
    example: 'clxyz1234567890',
    description: 'Order CUID (for order-scoped workspace chat)',
    required: false,
  })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({
    example: 'clxyz0987654321',
    description: 'Vendor Profile CUID (for pre-order direct inquiries)',
    required: false,
  })
  @IsOptional()
  @IsString()
  vendorProfileId?: string;
}
