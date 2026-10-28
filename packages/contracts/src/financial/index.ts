import { Paise } from '../types';

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

  const uniqueMemberIds = Array.from(new Set(beneficiaryMemberIds)).sort();
  const n = uniqueMemberIds.length;

  const baseShare = Math.floor(totalAmountPaise / n);
  const remainder = totalAmountPaise % n;

  const results: SplitResult[] = uniqueMemberIds.map((memberId, index) => {
    const sharePaise = index < remainder ? baseShare + 1 : baseShare;
    return {
      memberId,
      sharePaise,
    };
  });

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
