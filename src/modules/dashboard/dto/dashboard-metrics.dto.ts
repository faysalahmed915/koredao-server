/**
 * Membership snapshot attached to every dashboard, so the UI can render member
 * badges, renewal countdowns and upgrade prompts without a second request.
 */
import type {
  ModerationRequest,
  ModeratorAdminRequest,
} from '@prisma/client';

export interface MembershipSnapshot {
  isMember: boolean;
  plan: string | null;
  planName: string | null;
  status: string | null;
  startedAt: Date | null;
  expiresAt: Date | null;
  daysRemaining: number | null;
  autoRenew: boolean;
}

export interface CustomerDashboardMetrics {
  role: 'CUSTOMER';
  membership?: MembershipSnapshot;
  stats: {
    activeOrdersCount: number;
    underReviewOrdersCount: number;
    completedOrdersCount: number;
    totalSpent: number;
    openAssignmentsCount: number;
    totalAssignmentsPosted: number;
    totalBidsReceived: number;
    unreadMessagesCount: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    title: string;
    totalAmount: number;
    status: string;
    deadline: Date;
    vendorName: string;
    vendorUniversity: string;
    vendorImage?: string | null;
  }>;
  allAssignments: Array<{
    id: string;
    title: string;
    subject: string;
    budgetMin: number;
    budgetMax: number;
    bidsCount: number;
    status: string;
    createdAt: Date;
  }>;
  recommendedGigs: Array<{
    id: string;
    slug: string;
    title: string;
    category: string;
    priceFrom: number;
    rating: number;
    totalReviews: number;
    coverImage?: string;
    vendorName: string;
    vendorUniversity: string;
  }>;
}

export interface VendorDashboardMetrics {
  role: 'VENDOR';
  isApproved: boolean;
  verificationStatus: string;
  membership?: MembershipSnapshot;
  stats: {
    availableBalance: number;
    pendingEscrowBalance: number;
    totalEarned: number;
    totalWithdrawn: number;
    inProgressOrdersCount: number;
    deliveredOrdersCount: number;
    completedOrdersCount: number;
    activeBidsCount: number;
    acceptedBidsCount: number;
    totalBidsApplied: number;
    rating: number;
    totalReviews: number;
    unreadMessagesCount: number;
  };
  urgentOrders: Array<{
    id: string;
    orderNumber: string;
    title: string;
    totalAmount: number;
    status: string;
    deadline: Date;
    customerName: string;
    customerUniversity?: string | null;
    checkpointsCount: number;
  }>;
  allBids: Array<{
    id: string;
    assignmentId: string;
    assignmentTitle: string;
    proposedPrice: number;
    deliveryDays: number;
    status: string;
    createdAt: Date;
  }>;
  myGigs: Array<{
    id: string;
    slug: string;
    title: string;
    priceFrom: number;
    orderCount: number;
    rating: number;
    isActive: boolean;
  }>;
}

export interface AdminDashboardMetrics {
  role: 'ADMIN' | 'SUPER_ADMIN' | 'MODERATOR';
  stats: {
    totalUsers: number;
    totalVendors: number;
    totalCustomers: number;
    totalGigs: number;
    totalAssignments: number;
    totalOrders: number;
    totalEscrowHeld: number;
    totalPlatformRevenue: number;
    totalGMV: number;
    pendingVerificationsCount: number;
    disputedOrdersCount: number;
    safetyAlertsCount: number;
    pendingHelpRequestsCount: number;
    pendingAdminEscalationsCount: number;
  };
  pendingVerifications: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    university: string;
    department: string;
    idCardUrl?: string | null;
    createdAt: Date;
  }>;
  /** Moderator+ only: pending help requests from customers/vendors. */
  moderationHelpRequests: Array<{
    id: string;
    orderNumber: string;
    orderTitle: string;
    orderStatus: string;
    requestedById: string;
    requestedByName: string;
    requestedByRole: string;
    reason: string;
    createdAt: Date;
  }>;
  /** Admin only: pending moderator-to-admin escalation requests. */
  moderatorAdminEscalations: Array<{
    id: string;
    orderNumber?: string | null;
    orderTitle?: string | null;
    requestedById: string;
    requestedByName: string;
    requestedByRole: string;
    reason: string;
    createdAt: Date;
  }>;
  /** Admin only: all wallet transactions. Moderators must NOT see this. */
  recentTransactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    payoutMethod?: string | null;
    createdAt: Date;
  }>;
  disputedOrders: Array<{
    id: string;
    orderNumber: string;
    title: string;
    totalAmount: number;
    disputeReason?: string | null;
    createdAt: Date;
  }>;
}

/**
 * Dashboard for a user who holds the subscription-backed `MEMBER` role while
 * their base role is CUSTOMER. It is the customer view plus membership state and
 * the unlocked marketplace capabilities.
 */
export interface MemberDashboardMetrics {
  role: 'MEMBER';
  membership: MembershipSnapshot;
  perks: {
    canPostJobs: boolean;
    canTakeJobs: boolean;
    /** Platform fee applied to this member's completed orders, as a percentage. */
    platformFeePercent: number;
    /** Percentage points saved versus the standard 10% platform fee. */
    feeDiscountPercent: number;
  };
  stats: CustomerDashboardMetrics['stats'];
  recentOrders: CustomerDashboardMetrics['recentOrders'];
  allAssignments: CustomerDashboardMetrics['allAssignments'];
  recommendedGigs: CustomerDashboardMetrics['recommendedGigs'];
}

export type DashboardResponse =
  | CustomerDashboardMetrics
  | MemberDashboardMetrics
  | VendorDashboardMetrics
  | AdminDashboardMetrics;
