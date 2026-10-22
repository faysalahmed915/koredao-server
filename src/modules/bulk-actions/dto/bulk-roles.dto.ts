import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class BulkRoleItemDto {
  @ApiProperty({
    description: 'User ID to change the role for',
    example: 'usr-123',
  })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    enum: UserRole,
    description: 'New role to assign',
    example: UserRole.VENDOR,
  })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional({
    description: 'Audit note explaining the role change',
    example: 'Promoted to vendor after approval review',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkRolesDto {
  @ApiProperty({
    description: 'ID of the admin performing the bulk role change',
    example: 'admin-123',
  })
  @IsUUID()
  @IsNotEmpty()
  changedById!: string;

  @ApiProperty({
    description: 'List of role changes to apply',
    type: [BulkRoleItemDto],
  })
  @IsArray()
  @IsNotEmpty()
  items!: BulkRoleItemDto[];
}
