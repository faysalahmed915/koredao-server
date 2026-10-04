import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { AcademicLevel } from '@prisma/client';

export class UpdateVendorProfileDto {
  @ApiPropertyOptional({
    description: 'University / Institution name',
    example: 'University of Dhaka',
  })
  @IsOptional()
  @IsString()
  university?: string;

  @ApiPropertyOptional({
    description: 'Academic department or faculty',
    example: 'Computer Science and Engineering',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    enum: AcademicLevel,
    description: 'Academic level',
  })
  @IsOptional()
  @IsEnum(AcademicLevel)
  academicLevel?: AcademicLevel;

  @ApiPropertyOptional({
    description: 'Degree name',
    example: 'B.Sc in CSE',
  })
  @IsOptional()
  @IsString()
  degree?: string;

  @ApiPropertyOptional({
    description: 'Expected or graduated passing year',
    example: 2026,
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  passingYear?: number;

  @ApiPropertyOptional({
    description: 'Updated bio',
    example: 'Senior tutor and research assistant specializing in engineering reports.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'List of subjects or technical skills',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Updated ID card URL if re-verification is requested',
  })
  @IsOptional()
  @IsString()
  idCardUrl?: string;
}
