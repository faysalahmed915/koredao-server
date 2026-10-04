export interface CustomerDashboardMetrics {
  role: 'CUSTOMER';
  stats: {
    activeOrdersCount: number;
    underReviewOrdersCount: number;
    completedOrdersCount: number;
    totalSpent: number;
    openAssignmentsCount: number;
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
  recentAssignments: Array<{
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
  recentBids: Array<{
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

export type DashboardResponse =
  | CustomerDashboardMetrics
  | VendorDashboardMetrics
  | AdminDashboardMetrics;
