import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateRealNameDto {
  @ApiProperty({
    description:
      'Verified real name of the user. Only set/changed by moderator or above during identity verification.',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  realName!: string;
}
