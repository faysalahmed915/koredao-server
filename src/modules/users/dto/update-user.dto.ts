import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';


export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User display name',
    example: 'Alice Johnson',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'alice.new@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Profile avatar image URL',
    example: 'https://example.com/new-avatar.png',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: 'User role (e.g. customer, vendor, admin)',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  @IsOptional()
  @IsEnum(UserRole, {
    message: `Role must be: ${UserRole.CUSTOMER}`,
  })
  role?: UserRole;
}
