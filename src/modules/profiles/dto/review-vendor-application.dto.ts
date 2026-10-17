import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
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
    description:
      'Reason for rejection if application is rejected, or verified real name if approved.',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({
    description:
      "Verified real name of the user (only applied on approval). Set by the reviewing moderator after identity verification.",
    example: 'John Doe',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  realName?: string;
}
