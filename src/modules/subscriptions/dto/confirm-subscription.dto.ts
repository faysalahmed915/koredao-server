import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmSubscriptionDto {
  @ApiProperty({
    description: 'Identifier of the PENDING subscription returned by checkout.',
    example: 'clz8k2x1b0000abcd1234efgh',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  subscriptionId!: string;

  @ApiPropertyOptional({
    description:
      'Deprecated and ignored. Payment verification is bound to the merchant reference stored server-side at checkout, so a client-supplied reference can never influence which plan is activated. Accepted only for backwards compatibility.',
    deprecated: true,
    example: 'AMR-20240518-99XK21',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;
}
