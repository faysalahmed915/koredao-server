import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { HandwritingStyle } from '@prisma/client';

export class AddHandwritingSampleDto {
  @ApiProperty({
    description: 'Public URL to the handwriting sample image',
    example: 'https://storage.koredao.com/samples/sample-exam.jpg',
  })
  @IsString()
  @IsNotEmpty()
  sampleUrl!: string;

  @ApiProperty({
    enum: HandwritingStyle,
    description: 'Style category of the handwriting',
    example: HandwritingStyle.PRINT,
  })
  @IsEnum(HandwritingStyle)
  style!: HandwritingStyle;

  @ApiPropertyOptional({
    description: 'Self-assessed neatness score (1 to 10)',
    example: 9,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  neatnessScore?: number;

  @ApiPropertyOptional({
    description: 'Sample description (pen type, paper type, speed)',
    example: 'Neat print font on unruled paper with gel pen',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
