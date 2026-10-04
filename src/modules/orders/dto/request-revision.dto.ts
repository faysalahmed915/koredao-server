import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RequestRevisionDto {
  @ApiProperty({
    description: 'Detailed explanation of what needs revision or correction',
    example: 'Please recheck calculation on page 3. The Young modulus formula slope should use the corrected meter unit.',
  })
  @IsString()
  @IsNotEmpty()
  revisionNotes!: string;
}
