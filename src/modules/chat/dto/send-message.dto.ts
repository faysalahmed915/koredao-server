import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: 'clxyz1234567890',
    description: 'Conversation CUID',
  })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({
    example: 'Hello! I have started solving the differential equations on page 3.',
    description: 'Text content of the message',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({
    example: ['https://storage.koredao.com/chat/handwriting-preview.jpg'],
    description: 'Attached academic or handwriting file URLs',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
