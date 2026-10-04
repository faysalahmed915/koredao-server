import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { HandwritingStyle, AcademicLevel } from '@prisma/client';

export class QueryVendorsDto {
  @ApiPropertyOptional({
    description: 'Search keyword across name, university, department, or skills',
    example: 'calculus',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by university name',
    example: 'University of Dhaka',
  })
  @IsOptional()
  @IsString()
  university?: string;

  @ApiPropertyOptional({
    description: 'Filter by department',
    example: 'Computer Science and Engineering',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    enum: AcademicLevel,
    description: 'Filter by academic level',
  })
  @IsOptional()
  @IsEnum(AcademicLevel)
  academicLevel?: AcademicLevel;

  @ApiPropertyOptional({
    enum: HandwritingStyle,
    description: 'Filter by handwriting style',
  })
  @IsOptional()
  @IsEnum(HandwritingStyle)
  handwritingStyle?: HandwritingStyle;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
