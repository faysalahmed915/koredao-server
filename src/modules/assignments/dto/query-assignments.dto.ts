import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssignmentType, GigCategory, HandwritingStyle, AssignmentStatus } from '@prisma/client';

export class QueryAssignmentsDto {
  @ApiPropertyOptional({
    description: 'Search keyword across assignment title, description, or subject',
    example: 'physics lab',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: GigCategory,
    description: 'Filter by category',
  })
  @IsOptional()
  @IsEnum(GigCategory)
  category?: GigCategory;

  @ApiPropertyOptional({
    description: 'Filter by subject',
    example: 'Physics',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    enum: AssignmentType,
    description: 'Filter by Softcopy or Hardcopy deliverable',
  })
  @IsOptional()
  @IsEnum(AssignmentType)
  type?: AssignmentType;

  @ApiPropertyOptional({
    description: 'Filter by preferred university campus location',
    example: 'University of Dhaka',
  })
  @IsOptional()
  @IsString()
  preferredCampus?: string;

  @ApiPropertyOptional({
    enum: HandwritingStyle,
    description: 'Filter by requested handwriting style',
  })
  @IsOptional()
  @IsEnum(HandwritingStyle)
  handwritingStyle?: HandwritingStyle;

  @ApiPropertyOptional({
    description: 'Minimum budget filter in BDT',
    example: 300,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @ApiPropertyOptional({
    description: 'Maximum budget filter in BDT',
    example: 2000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxBudget?: number;

  @ApiPropertyOptional({
    enum: AssignmentStatus,
    description: 'Assignment status filter (default OPEN)',
    default: AssignmentStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus = AssignmentStatus.OPEN;

  @ApiPropertyOptional({
    description: 'Sort criteria',
    enum: ['deadline', 'budget_asc', 'budget_desc', 'bids', 'newest'],
    default: 'newest',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'deadline' | 'budget_asc' | 'budget_desc' | 'bids' | 'newest' = 'newest';

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 12;
}
