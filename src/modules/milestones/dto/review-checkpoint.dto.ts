import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CheckpointReviewDecision {
  ACCEPTED = 'ACCEPTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
}

export class ReviewCheckpointDto {
  @ApiProperty({
    enum: CheckpointReviewDecision,
    example: CheckpointReviewDecision.ACCEPTED,
    description: 'Client review decision for milestone progress',
  })
  @IsEnum(CheckpointReviewDecision)
  status!: CheckpointReviewDecision;

  @ApiProperty({
    example: 'Looks great! The handwriting is neat and equations are accurate. Please proceed.',
    description: 'Client feedback, notes, or revision directions',
    required: false,
  })
  @IsOptional()
  @IsString()
  clientFeedback?: string;
}
