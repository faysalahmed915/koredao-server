import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlan } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

export const SUPPORTED_SUBSCRIPTION_GATEWAYS = [
  'aamarpay',
  'piprapay',
  'sandbox',
] as const;

export type SubscriptionGateway =
  (typeof SUPPORTED_SUBSCRIPTION_GATEWAYS)[number];

export class CheckoutSubscriptionDto {
  @ApiProperty({
    description: 'Membership plan to purchase',
    enum: SubscriptionPlan,
    example: SubscriptionPlan.MEMBER_MONTHLY,
  })
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;

  @ApiPropertyOptional({
    description:
      'Payment gateway to route the checkout through. Defaults to sandbox.',
    enum: SUPPORTED_SUBSCRIPTION_GATEWAYS,
    default: 'sandbox',
  })
  @IsOptional()
  @IsIn(SUPPORTED_SUBSCRIPTION_GATEWAYS)
  gateway?: SubscriptionGateway;
}
