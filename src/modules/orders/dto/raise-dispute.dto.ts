import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RaiseDisputeDto {
  @ApiProperty({
    description: 'Detailed description of the dispute reason for moderation arbitration',
    example: 'Helper submitted incomplete work and failed to follow the requested handwriting style format.',
  })
  @IsString()
  @IsNotEmpty()
  disputeReason!: string;
}
