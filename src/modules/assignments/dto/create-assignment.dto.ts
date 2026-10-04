import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsArray,
  IsDateString,
} from 'class-validator';
import { AssignmentType, GigCategory, HandwritingStyle } from '@prisma/client';

export class CreateAssignmentDto {
  @ApiProperty({
    description: 'Descriptive title of the academic assignment or task',
    example: 'Physics Lab Report on Young Modulus with graph calculations',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Detailed instructions, guidelines, requirements, and formatting criteria',
    example: 'Need a complete 6-page lab report with Young modulus error calculation table. Handwritten in neat print font or LaTeX.',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    enum: GigCategory,
    description: 'Academic category',
    example: GigCategory.LAB_REPORT,
  })
  @IsEnum(GigCategory)
  category!: GigCategory;

  @ApiProperty({
    description: 'Academic subject or course code',
    example: 'Physics 101',
  })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({
    enum: AssignmentType,
    description: 'Softcopy digital submission or physical hardcopy deliverable',
    default: AssignmentType.SOFTCOPY,
    example: AssignmentType.SOFTCOPY,
  })
  @IsEnum(AssignmentType)
  type!: AssignmentType;

  @ApiProperty({
    description: 'Due date and time in ISO format',
    example: '2026-10-15T18:00:00.000Z',
  })
  @IsDateString()
  deadline!: string;

  @ApiProperty({
    description: 'Minimum budget willing to pay in BDT',
    example: 600,
    minimum: 100,
  })
  @IsNumber()
  @Min(100)
  budgetMin!: number;

  @ApiProperty({
    description: 'Maximum budget willing to pay in BDT',
    example: 1200,
    minimum: 100,
  })
  @IsNumber()
  @Min(100)
  budgetMax!: number;

  @ApiPropertyOptional({
    description: 'Delivery or courier address (if Hardcopy required)',
    example: 'Shahidullah Hall, University of Dhaka, Dhaka 1000',
  })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional({
    description: 'Preferred university campus for proximity matching (e.g. DU, BUET, BRAC Mohakhali)',
    example: 'University of Dhaka',
  })
  @IsOptional()
  @IsString()
  preferredCampus?: string;

  @ApiPropertyOptional({
    enum: HandwritingStyle,
    description: 'Preferred handwriting style if hardcopy is needed',
    example: HandwritingStyle.PRINT,
  })
  @IsOptional()
  @IsEnum(HandwritingStyle)
  preferredHandwritingStyle?: HandwritingStyle;

  @ApiPropertyOptional({
    description: 'Attachment URLs (question sheets, rubrics, lab datasets)',
    example: ['https://storage.koredao.com/assignments/lab-manual.pdf'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sampleFileUrls?: string[];
}
