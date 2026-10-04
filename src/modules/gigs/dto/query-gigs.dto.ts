import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { GigCategory, HandwritingStyle } from '@prisma/client';

export class QueryGigsDto {
  @ApiPropertyOptional({
    description: 'Search across gig title, description, subject tags, or university',
    example: 'calculus',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: GigCategory,
    description: 'Filter by core academic category',
  })
  @IsOptional()
  @IsEnum(GigCategory)
  category?: GigCategory;

  @ApiPropertyOptional({
    description: 'Filter by exact custom subject tag',
    example: 'Organic Chemistry',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Filter by vendor university',
    example: 'University of Dhaka',
  })
  @IsOptional()
  @IsString()
  university?: string;

  @ApiPropertyOptional({
    description: 'Filter gigs that provide physical hardcopies',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  requiresHardcopy?: boolean;

  @ApiPropertyOptional({
    enum: HandwritingStyle,
    description: 'Filter by handwriting style',
  })
  @IsOptional()
  @IsEnum(HandwritingStyle)
  handwritingStyle?: HandwritingStyle;

  @ApiPropertyOptional({
    description: 'Minimum price filter in BDT',
    example: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum price filter in BDT',
    example: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum delivery days filter',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDeliveryDays?: number;

  @ApiPropertyOptional({
    description: 'Sort criteria',
    enum: ['price_asc', 'price_desc', 'rating', 'orders', 'newest'],
    default: 'rating',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'orders' | 'newest' = 'rating';

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
