import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AcademicLevel, HandwritingStyle } from '@prisma/client';

export class HandwritingSampleInputDto {
  @ApiProperty({
    description: 'Public URL to handwriting sample image',
    example: 'https://storage.koredao.com/samples/sample-1.jpg',
  })
  @IsString()
  @IsNotEmpty()
  sampleUrl!: string;

  @ApiProperty({
    enum: HandwritingStyle,
    description: 'Style classification of the handwriting',
    example: HandwritingStyle.CURSIVE,
  })
  @IsEnum(HandwritingStyle)
  style!: HandwritingStyle;

  @ApiPropertyOptional({
    description: 'Self-assessed or initial neatness rating (1-10)',
    example: 8,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  neatnessScore?: number;

  @ApiPropertyOptional({
    description: 'Description or notes regarding the sample (e.g. Blue ballpoint, lined paper)',
    example: 'Fast exam cursive on ruled notebook',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateVendorApplicationDto {
  @ApiProperty({
    description: 'University / College / Institution name',
    example: 'University of Dhaka',
  })
  @IsString()
  @IsNotEmpty()
  university!: string;

  @ApiProperty({
    description: 'Academic department or faculty',
    example: 'Computer Science and Engineering',
  })
  @IsString()
  @IsNotEmpty()
  department!: string;

  @ApiPropertyOptional({
    enum: AcademicLevel,
    description: 'Academic level of the helper',
    default: AcademicLevel.UNDERGRADUATE,
    example: AcademicLevel.UNDERGRADUATE,
  })
  @IsOptional()
  @IsEnum(AcademicLevel)
  academicLevel?: AcademicLevel;

  @ApiPropertyOptional({
    description: 'Degree name (e.g. B.Sc in CSE, BBA, MBBS)',
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
    description: 'Brief bio highlighting academic background and subject expertise',
    example: 'Experienced in Calculus, Physics assignments, and fast handwritten lab reports.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'List of subjects or technical skills',
    example: ['Calculus', 'Organic Chemistry', 'Data Structures', 'Lab Notebooks'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({
    description: 'URL to uploaded student ID card or academic proof document',
    example: 'https://storage.koredao.com/verification/id-card-123.jpg',
  })
  @IsString()
  @IsNotEmpty()
  idCardUrl!: string;

  @ApiPropertyOptional({
    description: 'Initial handwriting samples submitted with the application',
    type: [HandwritingSampleInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HandwritingSampleInputDto)
  handwritingSamples?: HandwritingSampleInputDto[];
}
