import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { VerificationStatus } from '@prisma/client';

export class BulkVendorApplicationItemDto {
  @ApiProperty({
    description: 'VendorProfile ID to review',
    example: 'vp-123',
  })
  @IsUUID()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty({
    enum: VerificationStatus,
    description: 'Approval decision',
    example: VerificationStatus.APPROVED,
  })
  @IsEnum(VerificationStatus)
  status!: VerificationStatus;

  @ApiPropertyOptional({
    description: 'Reason for approval or rejection',
    example: 'Documents verified and complete',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkVendorApplicationsDto {
  @ApiProperty({
    description: 'List of vendor applications to review',
    type: [BulkVendorApplicationItemDto],
  })
  @IsArray()
  items!: BulkVendorApplicationItemDto[];
}
