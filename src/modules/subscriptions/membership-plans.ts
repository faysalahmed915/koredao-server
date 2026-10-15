import { SubscriptionPlan } from '@prisma/client';

/**
 * Public catalogue of purchasable KoreDao memberships.
 *
 * Prices are stored in **poisha** (the smallest BDT unit) so money is never
 * carried around as a float. `0` price plans are intentionally impossible: a
 * membership is only ever granted by a real (or explicitly sandboxed) payment.
 */
export interface MembershipPlanDefinition {
  plan: SubscriptionPlan;
  name: string;
  tagline: string;
  /** Price in poisha (1 BDT = 100 poisha). */
  price: number;
  currency: string;
  durationDays: number;
  /** Effective monthly price in poisha, for "save X%" comparisons. */
  monthlyEquivalent: number;
  savingsPercent: number;
  features: string[];
  highlight?: boolean;
}

export const MEMBERSHIP_PLANS: readonly MembershipPlanDefinition[] = Object.freeze([
  {
    plan: SubscriptionPlan.MEMBER_MONTHLY,
    name: 'Member Monthly',
    tagline: 'Try full marketplace access for 30 days',
    price: 49900,
    currency: 'BDT',
    durationDays: 30,
    monthlyEquivalent: 49900,
    savingsPercent: 0,
    features: [
      'Post unlimited job requests',
      'Submit proposals on any open job',
      'Priority placement in helper search',
      'Standard escrow protection',
    ],
  },
  {
    plan: SubscriptionPlan.MEMBER_QUARTERLY,
    name: 'Member Quarterly',
    tagline: 'The balanced plan for active students',
    price: 129900,
    currency: 'BDT',
    durationDays: 90,
    monthlyEquivalent: 43300,
    savingsPercent: 13,
    features: [
      'Everything in Member Monthly',
      'Save 13% versus monthly billing',
      'Reduced platform fee on completions',
      'Handwriting matcher priority queue',
    ],
    highlight: true,
  },
  {
    plan: SubscriptionPlan.MEMBER_YEARLY,
    name: 'Member Yearly',
    tagline: 'Best value for year-round academic work',
    price: 399900,
    currency: 'BDT',
    durationDays: 365,
    monthlyEquivalent: 33325,
    savingsPercent: 33,
    features: [
      'Everything in Member Quarterly',
      'Save 33% versus monthly billing',
      'Lowest platform fee tier',
      'Dedicated account support',
    ],
  },
] as const);

export function findMembershipPlan(
  plan: SubscriptionPlan,
): MembershipPlanDefinition | undefined {
  return MEMBERSHIP_PLANS.find((entry) => entry.plan === plan);
}
