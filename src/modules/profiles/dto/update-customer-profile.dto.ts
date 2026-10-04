import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({
    description: 'University / College name',
    example: 'BRAC University',
  })
  @IsOptional()
  @IsString()
  university?: string;

  @ApiPropertyOptional({
    description: 'Department name',
    example: 'Economics',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    description: 'Contact phone number',
    example: '+8801712345678',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Campus or residential hall',
    example: 'Mohakhali Campus',
  })
  @IsOptional()
  @IsString()
  campus?: string;
}
