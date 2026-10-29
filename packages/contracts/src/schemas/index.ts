import { z } from 'zod';
import {
  FINANCIAL_LIMITS,
  PAYMENT_METHODS,
  SPLIT_METHODS,
  TRIP_STATUSES,
} from '../constants';

// --- Auth Schemas ---

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  phone: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  paymentQrUrl: z.string().min(1, 'Payment QR code image is required'),
  paymentQrToken: z.string().optional().nullable(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const VerifyOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  purpose: z.enum(['EMAIL_VERIFY', 'PASSWORD_RESET']),
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;

export const ResendOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  purpose: z.enum(['EMAIL_VERIFY', 'PASSWORD_RESET']),
});
export type ResendOtpInput = z.infer<typeof ResendOtpSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  otp: z.string().length(6),
  newPassword: z.string().min(8).max(128),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  paymentQrUrl: z.string().optional().nullable(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// --- Trip Schemas ---

export const CreateTripSchema = z.object({
  name: z.string().min(2, 'Trip name is required').max(100),
  coverImageUrl: z.string().optional().nullable(),
  destination: z.string().max(100).optional().nullable(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Valid start date required'),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Valid end date required').optional().nullable(),
  currency: z.string().default('INR'),
  initialInvitedUserIds: z.array(z.string()).optional(),
});
export type CreateTripInput = z.infer<typeof CreateTripSchema>;

export const UpdateTripSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  coverImageUrl: z.string().optional().nullable(),
  destination: z.string().max(100).optional().nullable(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional().nullable(),
  status: z.enum(TRIP_STATUSES).optional(),
});
export type UpdateTripInput = z.infer<typeof UpdateTripSchema>;

export const InviteMemberSchema = z.object({
  userIdOrEmail: z.string().min(1, 'User identifier or email required'),
});
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const AddDummyMemberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});
export type AddDummyMemberInput = z.infer<typeof AddDummyMemberSchema>;

export const ReplaceDummyMemberSchema = z.object({
  registeredUserId: z.string().min(1, 'Registered user ID is required'),
});
export type ReplaceDummyMemberInput = z.infer<typeof ReplaceDummyMemberSchema>;

export const RespondInviteSchema = z.object({
  action: z.enum(['ACCEPT', 'DECLINE']),
});
export type RespondInviteInput = z.infer<typeof RespondInviteSchema>;

// --- Expense Schemas ---

export const ExpenseAllocationInputSchema = z.object({
  memberId: z.string().min(1),
  sharePaise: z.number().int().min(0, 'Share must be non-negative'),
});
export type ExpenseAllocationInput = z.infer<typeof ExpenseAllocationInputSchema>;

export const CreateExpenseSchema = z.object({
  payerMemberId: z.string().min(1, 'Payer member is required'),
  description: z.string().min(1, 'Description is required').max(200),
  amountPaise: z
    .number()
    .int()
    .min(FINANCIAL_LIMITS.MIN_AMOUNT_PAISE, 'Amount must be at least 1 paisa')
    .max(FINANCIAL_LIMITS.MAX_AMOUNT_PAISE, 'Amount exceeds maximum limit'),
  categoryId: z.string().min(1, 'Category is required'),
  splitMethod: z.enum(SPLIT_METHODS),
  allocations: z.array(ExpenseAllocationInputSchema).min(1, 'At least one beneficiary required'),
  note: z.string().max(500).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  expenseDate: z.string().optional(),
  receiptUrl: z.string().optional().nullable(),
}).refine(
  (data) => {
    const sum = data.allocations.reduce((acc, curr) => acc + curr.sharePaise, 0);
    return sum === data.amountPaise;
  },
  {
    message: 'The sum of all member shares must exactly equal the total expense amount in paise',
    path: ['allocations'],
  }
);
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

export const EditExpenseSchema = z.object({
  payerMemberId: z.string().min(1),
  description: z.string().min(1).max(200),
  amountPaise: z
    .number()
    .int()
    .min(FINANCIAL_LIMITS.MIN_AMOUNT_PAISE)
    .max(FINANCIAL_LIMITS.MAX_AMOUNT_PAISE),
  categoryId: z.string().min(1),
  splitMethod: z.enum(SPLIT_METHODS),
  allocations: z.array(ExpenseAllocationInputSchema).min(1),
  note: z.string().max(500).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  expenseDate: z.string().optional(),
  receiptUrl: z.string().optional().nullable(),
  expectedVersion: z.number().int().min(1),
  changeReason: z.string().max(255).optional().nullable(),
}).refine(
  (data) => {
    const sum = data.allocations.reduce((acc, curr) => acc + curr.sharePaise, 0);
    return sum === data.amountPaise;
  },
  {
    message: 'The sum of all member shares must exactly equal the total expense amount in paise',
    path: ['allocations'],
  }
);
export type EditExpenseInput = z.infer<typeof EditExpenseSchema>;

// --- Payment Schemas ---

export const CreatePaymentSchema = z.object({
  payerMemberId: z.string().min(1),
  receiverMemberId: z.string().min(1),
  amountPaise: z
    .number()
    .int()
    .min(FINANCIAL_LIMITS.MIN_AMOUNT_PAISE)
    .max(FINANCIAL_LIMITS.MAX_AMOUNT_PAISE),
  paymentMethod: z.enum(PAYMENT_METHODS),
  receiptUrl: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().max(100).optional(),
}).refine(
  (data) => data.payerMemberId !== data.receiverMemberId,
  {
    message: 'Payer and receiver must be different members',
    path: ['receiverMemberId'],
  }
);
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

export const ConfirmPaymentSchema = z.object({
  note: z.string().max(200).optional(),
});
export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentSchema>;

export const DisputePaymentSchema = z.object({
  reason: z.string().min(1, 'Dispute reason is required').max(500),
});
export type DisputePaymentInput = z.infer<typeof DisputePaymentSchema>;

// --- Settlement Discount Schemas ---

export const ProposeDiscountSchema = z.object({
  toMemberId: z.string().min(1),
  originalDebtPaise: z.number().int().min(1),
  paidAmountPaise: z.number().int().min(0),
  waivedPaise: z.number().int().min(1),
  reason: z.string().min(1).max(255),
  paymentId: z.string().optional().nullable(),
}).refine(
  (data) => data.paidAmountPaise + data.waivedPaise === data.originalDebtPaise,
  {
    message: 'Paid amount plus waived amount must equal original debt',
    path: ['waivedPaise'],
  }
);
export type ProposeDiscountInput = z.infer<typeof ProposeDiscountSchema>;

export const RespondDiscountSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT']),
});
export type RespondDiscountInput = z.infer<typeof RespondDiscountSchema>;

// --- Sync Schema ---

export const SyncPullSchema = z.object({
  lastSyncTimestamp: z.string().optional(),
  tripIds: z.array(z.string()).optional(),
});
export type SyncPullInput = z.infer<typeof SyncPullSchema>;

// --- Reports Schema ---

export const ExportReportSchema = z.object({
  reportType: z.enum(['INDIVIDUAL', 'TRIP_LEDGER']),
  format: z.enum(['PDF', 'XLSX']),
  memberId: z.string().optional(),
  includeReceipts: z.boolean().default(false),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type ExportReportInput = z.infer<typeof ExportReportSchema>;
