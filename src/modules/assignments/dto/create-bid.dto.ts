import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsInt,
  Min,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateBidDto {
  @ApiProperty({
    description: 'Proposed price in BDT',
    example: 800,
    minimum: 50,
  })
  @IsNumber()
  @Min(50)
  proposedPrice!: number;

  @ApiProperty({
    description: 'Estimated turnaround delivery in days',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  deliveryDays!: number;

  @ApiProperty({
    description: 'Cover letter explaining approach, academic qualification, and guarantees',
    example: 'I have completed this exact Young Modulus experiment at DU Physics. I can provide neat handwritten calculation graphs and formula derivations in 2 days.',
  })
  @IsString()
  @IsNotEmpty()
  coverLetter!: string;

  @ApiPropertyOptional({
    description: 'URLs to past related samples or handwriting demonstrations',
    type: [String],
    example: ['https://storage.koredao.com/samples/my-physics-lab.pdf'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sampleUrls?: string[];
}
