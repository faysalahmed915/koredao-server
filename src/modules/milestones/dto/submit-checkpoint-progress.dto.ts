import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class SubmitCheckpointProgressDto {
  @ApiProperty({
    example: 'https://storage.koredao.com/drafts/outline-v1.pdf',
    description: 'Digital file attachment URL (PDF, DOCX, ZIP)',
    required: false,
  })
  @IsOptional()
  @IsString()
  submittedFileUrl?: string;

  @ApiProperty({
    example: ['https://storage.koredao.com/proofs/page1.jpg', 'https://storage.koredao.com/proofs/page2.jpg'],
    description: 'Photo/scan URLs of handwritten drafts or physical proof',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proofPhotoUrls?: string[];

  @ApiProperty({
    example: 'Steadfast Courier: SF-12994020BD',
    description: 'Courier tracking code or in-person delivery location for hardcopy projects',
    required: false,
  })
  @IsOptional()
  @IsString()
  courierTracking?: string;

  @ApiProperty({
    example: 'Completed the methodology and equation proofs. Please check handwritten style.',
    description: 'Helper notes and explanations for client review',
    required: false,
  })
  @IsOptional()
  @IsString()
  vendorNotes?: string;
}
