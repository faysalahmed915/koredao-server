import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCheckpointDto {
  @ApiProperty({
    example: 'clxyz1234567890',
    description: 'Order CUID for which milestone is defined',
  })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({
    example: 'Literature Review & Outline Draft',
    description: 'Title of the milestone checkpoint',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: 'Deliver first 3 pages and list of research references for approval',
    description: 'Detailed description of milestone deliverable',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: '2026-10-15T18:00:00Z',
    description: 'Expected completion target date (ISO8601)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}
