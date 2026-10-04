import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiPropertyOptional({
    description: 'Gig ID if purchasing a service gig package',
    example: 'gig-cuid-123',
  })
  @IsOptional()
  @IsString()
  gigId?: string;

  @ApiPropertyOptional({
    description: 'Index of package selected (0 for Basic/Standard, 1, 2)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  packageIndex?: number = 0;

  @ApiPropertyOptional({
    description: 'Assignment ID if hiring for an assignment request',
    example: 'asg-cuid-123',
  })
  @IsOptional()
  @IsString()
  assignmentId?: string;

  @ApiPropertyOptional({
    description: 'Accepted Bid ID if hiring from an assignment proposal',
    example: 'bid-cuid-123',
  })
  @IsOptional()
  @IsString()
  bidId?: string;
}
