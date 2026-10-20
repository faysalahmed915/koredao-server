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
      "Verified real name of the user. Vendors supply it at application time; a reviewer may confirm or override it on approval.",
    example: 'John Doe',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  realName?: string;
}
