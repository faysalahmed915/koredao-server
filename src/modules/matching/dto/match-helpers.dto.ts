import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { HandwritingStyle } from '@prisma/client';

export class MatchHelpersDto {
  @ApiProperty({
    example: 'University of Dhaka',
    description: 'Filter by university name or code',
    required: false,
  })
  @IsOptional()
  @IsString()
  university?: string;

  @ApiProperty({
    example: 'Computer Science & Engineering',
    description: 'Filter by department or faculty',
    required: false,
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({
    example: 'Discrete Mathematics',
    description: 'Filter by subject or skill tags',
    required: false,
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    example: 'Bashundhara, Dhaka',
    description: 'Location or campus name',
    required: false,
  })
  @IsOptional()
  @IsString()
  locationName?: string;

  @ApiProperty({
    example: 23.8151,
    description: 'GPS Latitude for distance calculation',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({
    example: 90.4255,
    description: 'GPS Longitude for distance calculation',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({
    enum: HandwritingStyle,
    example: HandwritingStyle.CURSIVE,
    description: 'Target handwriting style for comparison',
    required: false,
  })
  @IsOptional()
  @IsEnum(HandwritingStyle)
  handwritingStyle?: HandwritingStyle;

  @ApiProperty({
    example: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c',
    description: 'Customer uploaded handwriting photo URL for side-by-side matching',
    required: false,
  })
  @IsOptional()
  @IsString()
  handwritingSampleUrl?: string;

  @ApiProperty({
    example: 5,
    description: 'Desired neatness level (1 to 5)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  desiredNeatness?: number;

  @ApiProperty({
    example: 30,
    description: 'Maximum proximity radius in km for hardcopy handoff',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  maxDistanceKm?: number;
}
