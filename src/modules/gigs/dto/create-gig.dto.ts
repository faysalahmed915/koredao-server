import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GigCategory, GigTierType, HandwritingStyle } from '@prisma/client';

export class GigPackageDto {
  @ApiProperty({
    description: 'Package tier name (e.g. Standard, Basic, Premium)',
    example: 'Standard',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Price for this package in BDT',
    example: 800,
    minimum: 50,
  })
  @IsNumber()
  @Min(50)
  price!: number;

  @ApiProperty({
    description: 'Estimated delivery turnaround time in days',
    example: 3,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  deliveryDays!: number;

  @ApiPropertyOptional({
    description: 'Number of included revisions',
    example: 2,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  revisions?: number = 1;

  @ApiPropertyOptional({
    description: 'Brief description of what is included in this tier',
    example: 'Up to 5 pages typed or handwritten lab report with calculations',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'List of specific features/deliverables included',
    example: ['5 Pages', 'Formula Sheet', 'Source Citations'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

export class GigAttachmentInputDto {
  @ApiProperty({
    description: 'Public URL of demo file or research paper sample',
    example: 'https://storage.koredao.com/demos/sample-report.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @ApiProperty({
    description: 'Original or display file name',
    example: 'Physics_Lab_Report_Sample.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiPropertyOptional({
    description: 'File MIME or extension type',
    example: 'application/pdf',
  })
  @IsOptional()
  @IsString()
  fileType?: string;

  @ApiPropertyOptional({
    description: 'File size in bytes',
    example: 1048576,
  })
  @IsOptional()
  @IsInt()
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Whether this file is a public sample shown on the gig page',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublicDemo?: boolean = true;
}

export class CreateGigDto {
  @ApiProperty({
    description: 'Clear, concise gig title',
    example: 'I will write complete Calculus and Differential Equations assignments with neat steps',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'In-depth description of the service, methodology, and requirements',
    example: 'Detailed assignment solution with step-by-step mathematical proofs. Available in neat handwriting or LaTeX typed format.',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    enum: GigCategory,
    description: 'Primary academic category',
    example: GigCategory.MATH_PROBLEM_SOLVING,
  })
  @IsEnum(GigCategory)
  category!: GigCategory;

  @ApiPropertyOptional({
    description: 'Custom subject tags for academic search matching',
    example: ['Calculus', 'Differential Equations', 'Linear Algebra'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectTags?: string[];

  @ApiPropertyOptional({
    description: 'Array of cover image URLs showcasing work or preview cards',
    example: ['https://storage.koredao.com/covers/math-cover-1.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coverImages?: string[];

  @ApiProperty({
    enum: GigTierType,
    description: 'Single fixed package or 3 tiered packages (Basic/Standard/Premium)',
    default: GigTierType.SINGLE,
    example: GigTierType.SINGLE,
  })
  @IsEnum(GigTierType)
  tierType!: GigTierType;

  @ApiProperty({
    description: 'Package definitions with pricing and delivery',
    type: [GigPackageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GigPackageDto)
  packages!: GigPackageDto[];

  @ApiPropertyOptional({
    description: 'Whether physical hardcopy delivery is required or available',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresHardcopy?: boolean = false;

  @ApiPropertyOptional({
    enum: HandwritingStyle,
    description: 'Handwriting style offered if this is a handwritten assignment',
  })
  @IsOptional()
  @IsEnum(HandwritingStyle)
  handwritingStyle?: HandwritingStyle;

  @ApiPropertyOptional({
    description: 'Sample demo files or previous work attachments',
    type: [GigAttachmentInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GigAttachmentInputDto)
  attachments?: GigAttachmentInputDto[];
}
