import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitDeliveryDto {
  @ApiProperty({
    description: 'URLs to completed deliverable files (e.g. PDF, images, source code, zipped lab)',
    example: ['https://storage.koredao.com/deliveries/completed-physics-lab.pdf'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  deliveryFiles!: string[];

  @ApiPropertyOptional({
    description: 'Notes, explanations, or instructions for the student',
    example: 'Here is your completed lab report. All graph slopes and calculations are written step-by-step.',
  })
  @IsOptional()
  @IsString()
  deliveryNotes?: string;
}
