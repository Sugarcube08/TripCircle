import {
  ExpenseCategoryKey,
  PaymentMethodType,
  SplitMethodType,
  PaymentStatusType,
  TripRoleType,
  TripStatusType,
  MembershipStatusType,
  DiscountStatusType,
  LedgerEventTypeType,
} from '../constants';

export type Paise = number; // Integer paise (e.g. 15000 = ₹150.00)

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  paymentQrUrl?: string | null;
}

export interface UserProfile extends UserSummary {
  isEmailVerified: boolean;
  completedTripCount: number;
  createdAt: string;
}

export interface TripMemberSummary {
  id: string;
  userId?: string | null;
  tripId: string;
  role: TripRoleType;
  status: MembershipStatusType;
  isDummy: boolean;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  user?: UserSummary | null;
  joinedAt?: string | null;
}

export interface ExpenseAllocationItem {
  id?: string;
  memberId: string;
  sharePaise: Paise;
  member?: TripMemberSummary;
}

export interface ExpenseRevisionSummary {
  id: string;
  expenseId: string;
  version: number;
  editorId: string;
  amountPaise: Paise;
  payerId: string;
  description: string;
  note?: string | null;
  location?: string | null;
  categoryId: string;
  receiptUrl?: string | null;
  allocationsSnapshot: { memberId: string; sharePaise: Paise }[];
  changeReason?: string | null;
  createdAt: string;
  editor?: UserSummary;
}

export interface ExpenseDetail {
  id: string;
  tripId: string;
  submitterId: string;
  payerId: string;
  amountPaise: Paise;
  categoryId: string;
  category?: { id: string; key: string; name: string; icon: string };
  description: string;
  note?: string | null;
  location?: string | null;
  expenseDate: string;
  receiptUrl?: string | null;
  version: number;
  splitMethod: SplitMethodType;
  allocations: ExpenseAllocationItem[];
  revisions?: ExpenseRevisionSummary[];
  payer?: TripMemberSummary;
  submitter?: UserSummary;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDetail {
  id: string;
  tripId: string;
  payerId: string;
  receiverId: string;
  amountPaise: Paise;
  paymentMethod: PaymentMethodType;
  status: PaymentStatusType;
  receiptUrl?: string | null;
  note?: string | null;
  disputeReason?: string | null;
  confirmedAt?: string | null;
  disputedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  payer?: TripMemberSummary;
  receiver?: TripMemberSummary;
}

export interface SettlementDiscountDetail {
  id: string;
  tripId: string;
  fromMemberId: string;
  toMemberId: string;
  originalDebtPaise: Paise;
  paidAmountPaise: Paise;
  waivedPaise: Paise;
  reason: string;
  status: DiscountStatusType;
  paymentId?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  fromMember?: TripMemberSummary;
  toMember?: TripMemberSummary;
}

export interface MemberNetBalance {
  memberId: string;
  userId?: string | null;
  userName: string;
  userAvatar?: string | null;
  isDummy?: boolean;
  totalPaidPaise: Paise;
  totalExpenseSharePaise: Paise;
  paymentsMadePaise: Paise;
  paymentsReceivedPaise: Paise;
  discountsGivenPaise: Paise;
  discountsReceivedPaise: Paise;
  netBalancePaise: Paise; // positive = owed money (+), negative = owes money (-)
}

export interface SimplifiedTransfer {
  fromMemberId: string;
  fromUserId?: string | null;
  fromUserName: string;
  toMemberId: string;
  toUserId?: string | null;
  toUserName: string;
  amountPaise: Paise;
}

export interface BilateralObligation {
  otherMemberId: string;
  otherUserId?: string | null;
  otherUserName: string;
  amountPaise: Paise; // positive = other owes current user, negative = current user owes other
}

export interface SettlementPlan {
  tripId: string;
  currency: string;
  generatedAt: string;
  isSettled: boolean;
  memberBalances: MemberNetBalance[];
  simplifiedTransfers: SimplifiedTransfer[];
  pendingPaymentsCount: number;
  disputedPaymentsCount: number;
  totalTripExpensePaise: Paise;
}

export interface TripSummary {
  id: string;
  name: string;
  coverImageUrl?: string | null;
  destination?: string | null;
  startDate: string;
  endDate?: string | null;
  currency: string;
  status: TripStatusType;
  creatorId: string;
  role: TripRoleType;
  membershipStatus: MembershipStatusType;
  memberCount: number;
  expenseCount: number;
  userNetBalancePaise: Paise; // current logged-in user balance in this trip
  lastActivityAt: string;
  createdAt: string;
}

export interface TripDetail extends TripSummary {
  members: TripMemberSummary[];
  totalExpensePaise: Paise;
  creator: UserSummary;
}

export interface NotificationItem {
  id: string;
  userId: string;
  tripId?: string | null;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface SyncPayload {
  lastSyncTimestamp: string;
  trips: TripSummary[];
  activeTripDetails?: {
    tripId: string;
    expenses: ExpenseDetail[];
    payments: PaymentDetail[];
    settlementPlan: SettlementPlan;
  }[];
  notifications: NotificationItem[];
}
