import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum DisputeDecision {
  RELEASE_TO_VENDOR = 'RELEASE_TO_VENDOR',
  REFUND_TO_CUSTOMER = 'REFUND_TO_CUSTOMER',
}

export class ResolveDisputeDto {
  @ApiProperty({
    enum: DisputeDecision,
    description: 'Moderator decision on the dispute',
    example: DisputeDecision.RELEASE_TO_VENDOR,
  })
  @IsEnum(DisputeDecision)
  @IsNotEmpty()
  decision!: DisputeDecision;

  @ApiPropertyOptional({
    description: 'Explanation of arbitration decision',
    example: 'Work was verified complete according to the original instructions.',
  })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
