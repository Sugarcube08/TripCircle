export const EXPENSE_CATEGORIES = [
  { key: 'FOOD_DINING', name: 'Food & Dining', icon: 'utensils' },
  { key: 'TRANSPORT', name: 'Transport', icon: 'car' },
  { key: 'ACCOMMODATION', name: 'Accommodation', icon: 'hotel' },
  { key: 'SHOPPING', name: 'Shopping', icon: 'shopping-bag' },
  { key: 'ACTIVITIES_ENTERTAINMENT', name: 'Activities & Entertainment', icon: 'ticket' },
  { key: 'GROCERIES', name: 'Groceries', icon: 'shopping-cart' },
  { key: 'FUEL', name: 'Fuel', icon: 'gas-pump' },
  { key: 'TICKETS_RESERVATIONS', name: 'Tickets & Reservations', icon: 'calendar-check' },
  { key: 'MISCELLANEOUS', name: 'Miscellaneous', icon: 'tag' },
] as const;

export type ExpenseCategoryKey = typeof EXPENSE_CATEGORIES[number]['key'];

export const PAYMENT_METHODS = ['UPI', 'CASH', 'OTHER'] as const;
export type PaymentMethodType = typeof PAYMENT_METHODS[number];

export const SPLIT_METHODS = ['EQUAL', 'UNEQUAL'] as const;
export type SplitMethodType = typeof SPLIT_METHODS[number];

export const PAYMENT_STATUSES = ['PENDING', 'CONFIRMED', 'DISPUTED', 'CANCELLED'] as const;
export type PaymentStatusType = typeof PAYMENT_STATUSES[number];

export const TRIP_ROLES = ['CREATOR', 'MEMBER'] as const;
export type TripRoleType = typeof TRIP_ROLES[number];

export const TRIP_STATUSES = ['ACTIVE', 'CLOSED'] as const;
export type TripStatusType = typeof TRIP_STATUSES[number];

export const MEMBERSHIP_STATUSES = ['INVITED', 'ACTIVE', 'DECLINED', 'LEFT'] as const;
export type MembershipStatusType = typeof MEMBERSHIP_STATUSES[number];

export const DISCOUNT_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED'] as const;
export type DiscountStatusType = typeof DISCOUNT_STATUSES[number];

export const LEDGER_EVENT_TYPES = [
  'EXPENSE_CREATED',
  'EXPENSE_EDITED',
  'PAYMENT_CONFIRMED',
  'SETTLEMENT_DISCOUNT',
] as const;
export type LedgerEventTypeType = typeof LEDGER_EVENT_TYPES[number];

export const FINANCIAL_LIMITS = {
  MIN_AMOUNT_PAISE: 1, // 1 paisa (₹0.01)
  MAX_AMOUNT_PAISE: 100_000_000, // ₹10,00,000.00 (10 lakh rupees)
  PAISE_PER_RUPEE: 100,
} as const;

export const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 5,
  RESEND_COOLDOWN_SECONDS: 60,
} as const;

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TRIP_CLOSED: 'TRIP_CLOSED',
  MEMBER_INACTIVE: 'MEMBER_INACTIVE',
  ALLOCATION_MISMATCH: 'ALLOCATION_MISMATCH',
  INVALID_PAYMENT_STATUS: 'INVALID_PAYMENT_STATUS',
} as const;
