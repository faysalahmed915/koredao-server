import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ModerationRequestStatus } from '@prisma/client';

export class RequestModeratorHelpDto {
  @ApiProperty({
    example: 'clxyz1234567890',
    description: 'Order CUID that needs moderator intervention',
  })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({
    example: 'The vendor has not responded to my messages for 3 days',
    description: 'Reason for requesting moderator help',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ResolveModerationRequestDto {
  @ApiProperty({
    example: 'clxyz-moderation-123',
    description: 'Moderation request CUID',
  })
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @ApiProperty({
    example: 'Contacted both parties, issue resolved',
    description: 'Moderator resolution note',
  })
  @IsString()
  @IsNotEmpty()
  moderatorNote!: string;

  @ApiProperty({
    enum: ModerationRequestStatus,
    example: 'RESOLVED',
    description: 'New status for the request',
  })
  @IsEnum(ModerationRequestStatus)
  status!: ModerationRequestStatus;
}

export class RequestAdminEscalationDto {
  @ApiPropertyOptional({
    example: 'clxyz1234567890',
    description: 'Order CUID related to the transaction issue',
  })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({
    example: 'Customer claims payment was released but escrow shows held',
    description: 'Reason for escalating to admin',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ResolveModeratorAdminRequestDto {
  @ApiProperty({
    example: 'clxyz-escalation-123',
    description: 'Moderator-to-admin request CUID',
  })
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @ApiProperty({
    example: 'Verified transaction logs, payment was released',
    description: 'Admin resolution note',
  })
  @IsString()
  @IsNotEmpty()
  adminNote!: string;

  @ApiProperty({
    enum: ['RESOLVED', 'DISMISSED'],
    example: 'RESOLVED',
    description: 'New status for the request',
  })
  @IsString()
  @IsNotEmpty()
  status!: 'RESOLVED' | 'DISMISSED';
}
