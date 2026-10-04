import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GigCategory, GigTierType, HandwritingStyle } from '@prisma/client';
import { GigPackageDto } from './create-gig.dto.js';

export class UpdateGigDto {
  @ApiPropertyOptional({
    description: 'Updated gig title',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: GigCategory,
  })
  @IsOptional()
  @IsEnum(GigCategory)
  category?: GigCategory;

  @ApiPropertyOptional({
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectTags?: string[];

  @ApiPropertyOptional({
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coverImages?: string[];

  @ApiPropertyOptional({
    enum: GigTierType,
  })
  @IsOptional()
  @IsEnum(GigTierType)
  tierType?: GigTierType;

  @ApiPropertyOptional({
    type: [GigPackageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GigPackageDto)
  packages?: GigPackageDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresHardcopy?: boolean;

  @ApiPropertyOptional({
    enum: HandwritingStyle,
  })
  @IsOptional()
  @IsEnum(HandwritingStyle)
  handwritingStyle?: HandwritingStyle;

  @ApiPropertyOptional({
    description: 'Whether the gig is currently active and visible to buyers',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
