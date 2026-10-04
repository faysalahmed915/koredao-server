import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VerificationStatus } from '@prisma/client';

export class ReviewVendorApplicationDto {
  @ApiProperty({
    enum: [VerificationStatus.APPROVED, VerificationStatus.REJECTED],
    description: 'Decision on the vendor application',
    example: VerificationStatus.APPROVED,
  })
  @IsEnum(VerificationStatus)
  @IsNotEmpty()
  status!: VerificationStatus;

  @ApiPropertyOptional({
    description: 'Reason for rejection if application is rejected',
    example: 'Student ID card image is blurred and unreadable. Please re-upload a clear copy.',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
