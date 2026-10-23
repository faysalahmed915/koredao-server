import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RaiseDisputeDto {
  @ApiProperty({
    description: 'Detailed description of the dispute reason for moderation arbitration',
    example: 'Helper submitted incomplete work and failed to follow the requested handwriting style format.',
  })
  @IsString()
  @IsNotEmpty()
  disputeReason!: string;

  /** Alias for disputeReason - kept for frontend consistency */
  @ApiPropertyOptional({
    description: 'Alias for disputeReason',
    example: 'Helper submitted incomplete work and failed to follow the requested handwriting style format.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;

  /** Optional evidence/proof for the dispute (screenshots, messages, partial deliveries, etc.) */
  @ApiPropertyOptional({
    description: 'Evidence or proof supporting the dispute (screenshots, chat logs, partial deliveries)',
    example: 'https://storage.koredao.com/disputes/evidence-123.png',
  })
  @IsOptional()
  @IsString()
  evidence?: string;
}
