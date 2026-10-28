import { Paise } from '@tripcircle/contracts';

export interface SplitMemberInput {
  memberId: string;
  sharePaise?: Paise;
}

export interface SplitResult {
  memberId: string;
  sharePaise: Paise;
}

/**
 * Distributes integer paise equally among beneficiaries,
 * assigning remainder paise deterministically (1 paisa to each of the first remainder beneficiaries).
 * Invariant: sum(shares) === totalAmountPaise
 */
export function calculateEqualSplit(
  totalAmountPaise: Paise,
  beneficiaryMemberIds: string[]
): SplitResult[] {
  if (!Number.isInteger(totalAmountPaise) || totalAmountPaise <= 0) {
    throw new Error(`Invalid total amount paise: ${totalAmountPaise}. Must be a positive integer.`);
  }

  if (!beneficiaryMemberIds || beneficiaryMemberIds.length === 0) {
    throw new Error('At least one beneficiary is required for equal split.');
  }

  // Deduplicate and sort deterministically
  const uniqueMemberIds = Array.from(new Set(beneficiaryMemberIds)).sort();
  const n = uniqueMemberIds.length;

  const baseShare = Math.floor(totalAmountPaise / n);
  const remainder = totalAmountPaise % n;

  const results: SplitResult[] = uniqueMemberIds.map((memberId, index) => {
    // First 'remainder' members receive 1 extra paisa
    const sharePaise = index < remainder ? baseShare + 1 : baseShare;
    return {
      memberId,
      sharePaise,
    };
  });

  // Verify invariant
  const sum = results.reduce((acc, curr) => acc + curr.sharePaise, 0);
  if (sum !== totalAmountPaise) {
    throw new Error(
      `Internal calculation error: sum of shares (${sum}) does not match total (${totalAmountPaise})`
    );
  }

  return results;
}

/**
 * Validates and normalizes unequal split allocations.
 * Invariant: sum(shares) === totalAmountPaise and all sharePaise >= 0
 */
export function validateUnequalSplit(
  totalAmountPaise: Paise,
  allocations: { memberId: string; sharePaise: Paise }[]
): SplitResult[] {
  if (!Number.isInteger(totalAmountPaise) || totalAmountPaise <= 0) {
    throw new Error(`Invalid total amount paise: ${totalAmountPaise}. Must be a positive integer.`);
  }

  if (!allocations || allocations.length === 0) {
    throw new Error('At least one allocation is required.');
  }

  let totalAllocated = 0;
  const seenMembers = new Set<string>();

  for (const item of allocations) {
    if (!item.memberId) {
      throw new Error('Invalid memberId in allocation');
    }
    if (seenMembers.has(item.memberId)) {
      throw new Error(`Duplicate allocation for member: ${item.memberId}`);
    }
    seenMembers.add(item.memberId);

    if (!Number.isInteger(item.sharePaise) || item.sharePaise < 0) {
      throw new Error(`Invalid share paise for member ${item.memberId}: ${item.sharePaise}`);
    }

    totalAllocated += item.sharePaise;
  }

  if (totalAllocated !== totalAmountPaise) {
    throw new Error(
      `Allocation sum mismatch: sum of member shares (${totalAllocated} paise) does not equal total amount (${totalAmountPaise} paise)`
    );
  }

  return allocations.map((a) => ({ memberId: a.memberId, sharePaise: a.sharePaise }));
}

export interface ExpenseRecord {
  id: string;
  payerMemberId: string;
  amountPaise: Paise;
  allocations: { memberId: string; sharePaise: Paise }[];
  isDeleted?: boolean;
}

export interface ConfirmedPaymentRecord {
  id: string;
  payerMemberId: string;
  receiverMemberId: string;
  amountPaise: Paise;
}

export interface AcceptedDiscountRecord {
  id: string;
  fromMemberId: string; // debtor who paid/was forgiven
  toMemberId: string;   // creditor who waived
  waivedPaise: Paise;
}

export interface MemberFinancialState {
  memberId: string;
  totalPaidPaise: Paise;
  totalExpenseSharePaise: Paise;
  paymentsMadePaise: Paise;
  paymentsReceivedPaise: Paise;
  discountsGivenPaise: Paise;    // Creditor waived for someone
  discountsReceivedPaise: Paise; // Debtor had amount waived
  netBalancePaise: Paise;        // Positive = owed money, negative = owes money
}

/**
 * Calculates net balances for all members across a trip.
 * Enforces invariant: SUM(all net balances) === 0
 */
export function calculateTripNetBalances(
  allMemberIds: string[],
  expenses: ExpenseRecord[],
  confirmedPayments: ConfirmedPaymentRecord[],
  acceptedDiscounts: AcceptedDiscountRecord[]
): Map<string, MemberFinancialState> {
  const memberMap = new Map<string, MemberFinancialState>();

  for (const memberId of allMemberIds) {
    memberMap.set(memberId, {
      memberId,
      totalPaidPaise: 0,
      totalExpenseSharePaise: 0,
      paymentsMadePaise: 0,
      paymentsReceivedPaise: 0,
      discountsGivenPaise: 0,
      discountsReceivedPaise: 0,
      netBalancePaise: 0,
    });
  }

  // 1. Process active expenses
  for (const exp of expenses) {
    if (exp.isDeleted) continue;

    // Credit payer
    const payerState = memberMap.get(exp.payerMemberId);
    if (payerState) {
      payerState.totalPaidPaise += exp.amountPaise;
    }

    // Debit beneficiaries
    for (const alloc of exp.allocations) {
      const benState = memberMap.get(alloc.memberId);
      if (benState) {
        benState.totalExpenseSharePaise += alloc.sharePaise;
      }
    }
  }

  // 2. Process confirmed payments
  for (const p of confirmedPayments) {
    const payerState = memberMap.get(p.payerMemberId);
    if (payerState) {
      payerState.paymentsMadePaise += p.amountPaise;
    }

    const receiverState = memberMap.get(p.receiverMemberId);
    if (receiverState) {
      receiverState.paymentsReceivedPaise += p.amountPaise;
    }
  }

  // 3. Process accepted discounts
  for (const d of acceptedDiscounts) {
    // toMember waived amount (gives discount)
    const creditorState = memberMap.get(d.toMemberId);
    if (creditorState) {
      creditorState.discountsGivenPaise += d.waivedPaise;
    }

    // fromMember received waiver (debt cleared without paying)
    const debtorState = memberMap.get(d.fromMemberId);
    if (debtorState) {
      debtorState.discountsReceivedPaise += d.waivedPaise;
    }
  }

  // 4. Calculate final net balances:
  // net = (totalPaid - totalExpenseShare) + (paymentsMade - paymentsReceived) + (discountsGiven - discountsReceived)
  // Explanation:
  // - totalPaid - totalExpenseShare: initial ledger balance from expenses
  // - paymentsMade: increases payer's net balance towards 0
  // - paymentsReceived: decreases receiver's net balance towards 0
  // - discountsReceived: acts as if debtor paid the waived amount, reducing their debt (increasing net balance towards 0)
  // - discountsGiven: creditor forgave debt, reducing their credit (decreasing net balance towards 0)
  let sumNetBalances = 0;

  for (const state of memberMap.values()) {
    state.netBalancePaise =
      (state.totalPaidPaise - state.totalExpenseSharePaise) +
      (state.paymentsMadePaise - state.paymentsReceivedPaise) +
      (state.discountsReceivedPaise - state.discountsGivenPaise);

    sumNetBalances += state.netBalancePaise;
  }

  // 5. Invariant verification: SUM(all net balances) === 0
  if (sumNetBalances !== 0) {
    throw new Error(
      `Financial invariant violated! Sum of member net balances is ${sumNetBalances} paise, expected 0.`
    );
  }

  return memberMap;
}

export interface DebtTransfer {
  fromMemberId: string;
  toMemberId: string;
  amountPaise: Paise;
}

/**
 * Deterministic Greedy Settlement / Debt Simplification Algorithm.
 * Matches largest debtors with largest creditors in exact integer paise.
 * Reconciles completely with net balances.
 */
export function calculateSettlementPlan(
  memberBalances: Map<string, MemberFinancialState>
): DebtTransfer[] {
  // Debtors have netBalancePaise < 0 (they owe money)
  // Creditors have netBalancePaise > 0 (they are owed money)
  const debtors: { memberId: string; debtPaise: number }[] = [];
  const creditors: { memberId: string; creditPaise: number }[] = [];

  for (const [memberId, state] of memberBalances.entries()) {
    if (state.netBalancePaise < 0) {
      debtors.push({ memberId, debtPaise: Math.abs(state.netBalancePaise) });
    } else if (state.netBalancePaise > 0) {
      creditors.push({ memberId, creditPaise: state.netBalancePaise });
    }
  }

  // Sort deterministically: highest amount first, then by memberId asc
  const sortDesc = (a: { memberId: string; amount: number }, b: { memberId: string; amount: number }) => {
    if (b.amount !== a.amount) {
      return b.amount - a.amount;
    }
    return a.memberId.localeCompare(b.memberId);
  };

  debtors.sort((a, b) => sortDesc({ memberId: a.memberId, amount: a.debtPaise }, { memberId: b.memberId, amount: b.debtPaise }));
  creditors.sort((a, b) => sortDesc({ memberId: a.memberId, amount: a.creditPaise }, { memberId: b.memberId, amount: b.creditPaise }));

  const transfers: DebtTransfer[] = [];
  let debtorIdx = 0;
  let creditorIdx = 0;

  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];

    const amountPaise = Math.min(debtor.debtPaise, creditor.creditPaise);

    if (amountPaise > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountPaise,
      });

      debtor.debtPaise -= amountPaise;
      creditor.creditPaise -= amountPaise;
    }

    if (debtor.debtPaise === 0) {
      debtorIdx++;
    }
    if (creditor.creditPaise === 0) {
      creditorIdx++;
    }
  }

  // Invariant verification: all debts and credits must be completely settled
  for (let i = debtorIdx; i < debtors.length; i++) {
    if (debtors[i].debtPaise > 0) {
      throw new Error(`Unsettled debt remaining for member ${debtors[i].memberId}: ${debtors[i].debtPaise}`);
    }
  }
  for (let j = creditorIdx; j < creditors.length; j++) {
    if (creditors[j].creditPaise > 0) {
      throw new Error(`Unsettled credit remaining for member ${creditors[j].memberId}: ${creditors[j].creditPaise}`);
    }
  }

  return transfers;
}

/**
 * Calculates raw bilateral (person-to-person) obligations before debt simplification.
 * Shows direct obligations based on shared expenses and direct payments.
 */
export function calculateBilateralObligations(
  currentMemberId: string,
  allMemberIds: string[],
  expenses: ExpenseRecord[],
  confirmedPayments: ConfirmedPaymentRecord[],
  acceptedDiscounts: AcceptedDiscountRecord[]
): Map<string, Paise> {
  const obligations = new Map<string, Paise>();

  for (const otherId of allMemberIds) {
    if (otherId !== currentMemberId) {
      obligations.set(otherId, 0);
    }
  }

  // 1. Expenses: if currentMember paid, other beneficiaries owe currentMember their share.
  // If other member paid, currentMember owes them their share.
  for (const exp of expenses) {
    if (exp.isDeleted) continue;

    if (exp.payerMemberId === currentMemberId) {
      for (const alloc of exp.allocations) {
        if (alloc.memberId !== currentMemberId) {
          const current = obligations.get(alloc.memberId) || 0;
          obligations.set(alloc.memberId, current + alloc.sharePaise);
        }
      }
    } else {
      const payerId = exp.payerMemberId;
      for (const alloc of exp.allocations) {
        if (alloc.memberId === currentMemberId) {
          const current = obligations.get(payerId) || 0;
          obligations.set(payerId, current - alloc.sharePaise);
        }
      }
    }
  }

  // 2. Direct payments between currentMember and others
  for (const p of confirmedPayments) {
    if (p.payerMemberId === currentMemberId && obligations.has(p.receiverMemberId)) {
      // currentMember paid other -> reduces debt to other
      const current = obligations.get(p.receiverMemberId) || 0;
      obligations.set(p.receiverMemberId, current + p.amountPaise);
    } else if (p.receiverMemberId === currentMemberId && obligations.has(p.payerMemberId)) {
      // other paid currentMember -> reduces other's debt to currentMember
      const current = obligations.get(p.payerMemberId) || 0;
      obligations.set(p.payerMemberId, current - p.amountPaise);
    }
  }

  // 3. Accepted discounts
  for (const d of acceptedDiscounts) {
    if (d.fromMemberId === currentMemberId && obligations.has(d.toMemberId)) {
      // currentMember had debt waived -> debt reduced
      const current = obligations.get(d.toMemberId) || 0;
      obligations.set(d.toMemberId, current + d.waivedPaise);
    } else if (d.toMemberId === currentMemberId && obligations.has(d.fromMemberId)) {
      // currentMember waived debt for other -> credit reduced
      const current = obligations.get(d.fromMemberId) || 0;
      obligations.set(d.fromMemberId, current - d.waivedPaise);
    }
  }

  return obligations;
}
