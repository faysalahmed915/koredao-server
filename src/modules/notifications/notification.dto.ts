import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const NOTIFICATION_TYPES = [
  'VENDOR_APPLICATION_APPROVED',
  'VENDOR_APPLICATION_REJECTED',
  'DISPUTE_SLA_COUNTDOWN',
  'DISPUTE_SLA_BREACH',
  'ESCROW_RELEASE_WARNING',
  'SAFETY_ALERT',
  'TEST',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export class NotificationListQuery {
  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Only return unread notifications', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean = false;
}

export class MarkReadDto {
  @ApiProperty({ description: 'ID of the notification to mark as read' })
  @IsUUID()
  @IsNotEmpty()
  notificationId!: string;
}

export class UpdatePreferenceDto {
  @ApiPropertyOptional({ description: 'Enable email delivery', default: true })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable in-app delivery', default: true })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Vendor application outcome notifications', default: true })
  @IsOptional()
  @IsBoolean()
  vendorAppOutcome?: boolean;

  @ApiPropertyOptional({ description: 'Dispute SLA countdown/breach notifications', default: true })
  @IsOptional()
  @IsBoolean()
  disputeSla?: boolean;

  @ApiPropertyOptional({ description: 'Escrow 72-hour release warning notifications', default: true })
  @IsOptional()
  @IsBoolean()
  releaseWarning?: boolean;

  @ApiPropertyOptional({ description: 'Chat safety alert notifications', default: true })
  @IsOptional()
  @IsBoolean()
  safetyAlert?: boolean;
}

export class CreateNotificationDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  userId?: string;

  @ApiProperty({ enum: NOTIFICATION_TYPES, description: 'Notification type' })
  @IsEnum(NOTIFICATION_TYPES as any)
  @IsNotEmpty()
  type!: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'Notification body' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ description: 'Structured payload (orderId, moderationRequestId, ...)' })
  @IsOptional()
  dataJson?: Record<string, unknown>;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  dataJson?: Record<string, unknown>;
  read: boolean;
  readAt?: string;
  emailSent: boolean;
  emailSentAt?: string;
  createdAt: string;
}

export interface PreferenceResponse {
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  vendorAppOutcome: boolean;
  disputeSla: boolean;
  releaseWarning: boolean;
  safetyAlert: boolean;
  updatedAt: string;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface SlaTrackerItem {
  moderationRequestId: string;
  orderId: string;
  requestedBy: { id: string; name: string; email: string };
  assignedModeratorId: string | null;
  status: string;
  priority: string;
  createdAt: string;
  slaHours: number;
  secondsRemaining: number;
  breached: boolean;
}

export interface SlaTrackerResponse {
  slaHours: number;
  items: SlaTrackerItem[];
}
