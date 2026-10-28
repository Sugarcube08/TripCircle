import { describe, it, expect } from 'vitest';
import {
  calculateEqualSplit,
  validateUnequalSplit,
  calculateTripNetBalances,
  calculateSettlementPlan,
  calculateBilateralObligations,
} from '../../src/modules/financial/calculator';

describe('Financial Engine - Equal Split and Paise Precision', () => {
  it('splits evenly when amount is perfectly divisible', () => {
    // ₹120.00 = 12000 paise among 3 members: 4000 paise each
    const splits = calculateEqualSplit(12000, ['userA', 'userB', 'userC']);
    expect(splits).toHaveLength(3);
    expect(splits[0].sharePaise).toBe(4000);
    expect(splits[1].sharePaise).toBe(4000);
    expect(splits[2].sharePaise).toBe(4000);

    const sum = splits.reduce((acc, c) => acc + c.sharePaise, 0);
    expect(sum).toBe(12000);
  });

  it('distributes indivisible paise remainder deterministically', () => {
    // ₹100.00 = 10000 paise among 3 members:
    // 10000 / 3 = 3333 remainder 1.
    // userA gets 3334, userB gets 3333, userC gets 3333.
    const splits = calculateEqualSplit(10000, ['userB', 'userA', 'userC']);
    // Deterministic ordering by memberId: userA, userB, userC
    expect(splits[0].memberId).toBe('userA');
    expect(splits[0].sharePaise).toBe(3334);
    expect(splits[1].memberId).toBe('userB');
    expect(splits[1].sharePaise).toBe(3333);
    expect(splits[2].memberId).toBe('userC');
    expect(splits[2].sharePaise).toBe(3333);

    const sum = splits.reduce((acc, c) => acc + c.sharePaise, 0);
    expect(sum).toBe(10000);
  });

  it('distributes 2 paise remainder correctly across 4 members', () => {
    // ₹10.02 = 1002 paise among 4 members:
    // 1002 / 4 = 250 remainder 2.
    // first two get 251, next two get 250. Sum = 1002.
    const splits = calculateEqualSplit(1002, ['m1', 'm2', 'm3', 'm4']);
    expect(splits[0].sharePaise).toBe(251);
    expect(splits[1].sharePaise).toBe(251);
    expect(splits[2].sharePaise).toBe(250);
    expect(splits[3].sharePaise).toBe(250);

    const sum = splits.reduce((acc, c) => acc + c.sharePaise, 0);
    expect(sum).toBe(1002);
  });

  it('rejects invalid or non-positive amounts', () => {
    expect(() => calculateEqualSplit(0, ['m1'])).toThrow();
    expect(() => calculateEqualSplit(-500, ['m1'])).toThrow();
    expect(() => calculateEqualSplit(100.5, ['m1'])).toThrow();
    expect(() => calculateEqualSplit(1000, [])).toThrow();
  });
});

describe('Financial Engine - Unequal Split', () => {
  it('accepts exact allocations matching total', () => {
    const allocations = [
      { memberId: 'm1', sharePaise: 4500 },
      { memberId: 'm2', sharePaise: 5500 },
    ];
    const result = validateUnequalSplit(10000, allocations);
    expect(result).toHaveLength(2);
    expect(result[0].sharePaise).toBe(4500);
    expect(result[1].sharePaise).toBe(5500);
  });

  it('rejects allocation sum mismatch', () => {
    const allocations = [
      { memberId: 'm1', sharePaise: 4000 },
      { memberId: 'm2', sharePaise: 5000 },
    ];
    expect(() => validateUnequalSplit(10000, allocations)).toThrow(
      /Allocation sum mismatch/
    );
  });

  it('rejects negative allocations', () => {
    const allocations = [
      { memberId: 'm1', sharePaise: -100 },
      { memberId: 'm2', sharePaise: 10100 },
    ];
    expect(() => validateUnequalSplit(10000, allocations)).toThrow();
  });

  it('allows 0 paise allocation for a beneficiary who was included with 0 share', () => {
    const allocations = [
      { memberId: 'm1', sharePaise: 10000 },
      { memberId: 'm2', sharePaise: 0 },
    ];
    const result = validateUnequalSplit(10000, allocations);
    expect(result[1].sharePaise).toBe(0);
  });
});

describe('Financial Invariants and Trip Balance Calculation', () => {
  it('maintains SUM(net balances) === 0 across members for standard expenses', () => {
    const allMembers = ['Alice', 'Bob', 'Charlie', 'Dave'];

    // Alice pays ₹1,200 (120000 paise) split equally among Alice, Bob, Charlie (excluding Dave)
    const exp1 = {
      id: 'e1',
      payerMemberId: 'Alice',
      amountPaise: 120000,
      allocations: [
        { memberId: 'Alice', sharePaise: 40000 },
        { memberId: 'Bob', sharePaise: 40000 },
        { memberId: 'Charlie', sharePaise: 40000 },
      ],
    };

    // Bob pays ₹600 (60000 paise) split equally among all 4 members (15000 paise each)
    const exp2 = {
      id: 'e2',
      payerMemberId: 'Bob',
      amountPaise: 60000,
      allocations: [
        { memberId: 'Alice', sharePaise: 15000 },
        { memberId: 'Bob', sharePaise: 15000 },
        { memberId: 'Charlie', sharePaise: 15000 },
        { memberId: 'Dave', sharePaise: 15000 },
      ],
    };

    const balances = calculateTripNetBalances(allMembers, [exp1, exp2], [], []);

    // Alice: Paid 120000. Share: 40000 + 15000 = 55000. Net = +65000 paise (+₹650)
    expect(balances.get('Alice')?.netBalancePaise).toBe(65000);

    // Bob: Paid 60000. Share: 40000 + 15000 = 55000. Net = +5000 paise (+₹50)
    expect(balances.get('Bob')?.netBalancePaise).toBe(5000);

    // Charlie: Paid 0. Share: 40000 + 15000 = 55000. Net = -55000 paise (-₹550)
    expect(balances.get('Charlie')?.netBalancePaise).toBe(-55000);

    // Dave: Paid 0. Share: 15000. Net = -15000 paise (-₹150)
    expect(balances.get('Dave')?.netBalancePaise).toBe(-15000);

    // Invariant: sum of all net balances must equal 0
    let totalNet = 0;
    for (const b of balances.values()) {
      totalNet += b.netBalancePaise;
    }
    expect(totalNet).toBe(0);
  });

  it('updates balances when payments are confirmed and maintains zero-sum invariant', () => {
    const allMembers = ['Alice', 'Bob'];

    // Alice pays ₹1,000 for Bob
    const exp = {
      id: 'e1',
      payerMemberId: 'Alice',
      amountPaise: 100000,
      allocations: [{ memberId: 'Bob', sharePaise: 100000 }],
    };

    // Before payment: Alice is +100000, Bob is -100000
    const initial = calculateTripNetBalances(allMembers, [exp], [], []);
    expect(initial.get('Alice')?.netBalancePaise).toBe(100000);
    expect(initial.get('Bob')?.netBalancePaise).toBe(-100000);

    // Bob makes a confirmed payment of ₹600 (60000 paise) to Alice
    const payment = {
      id: 'p1',
      payerMemberId: 'Bob',
      receiverMemberId: 'Alice',
      amountPaise: 60000,
    };

    const afterPayment = calculateTripNetBalances(allMembers, [exp], [payment], []);

    // Alice: was owed 1000, received 600 -> now owed 40000 paise (+₹400)
    expect(afterPayment.get('Alice')?.netBalancePaise).toBe(40000);
    // Bob: owed 1000, paid 600 -> now owes 40000 paise (-₹400)
    expect(afterPayment.get('Bob')?.netBalancePaise).toBe(-40000);

    let sum = 0;
    for (const b of afterPayment.values()) {
      sum += b.netBalancePaise;
    }
    expect(sum).toBe(0);
  });

  it('handles explicit settlement discounts correctly', () => {
    const allMembers = ['Alice', 'Bob'];

    // Alice paid ₹1,586.65 (158665 paise) for Bob
    const exp = {
      id: 'e1',
      payerMemberId: 'Alice',
      amountPaise: 158665,
      allocations: [{ memberId: 'Bob', sharePaise: 158665 }],
    };

    // Bob pays whole ₹1,586.00 (158600 paise)
    const payment = {
      id: 'p1',
      payerMemberId: 'Bob',
      receiverMemberId: 'Alice',
      amountPaise: 158600,
    };

    // Alice accepts waiving the remaining 65 paise
    const discount = {
      id: 'd1',
      fromMemberId: 'Bob',
      toMemberId: 'Alice',
      waivedPaise: 65,
    };

    const balances = calculateTripNetBalances(allMembers, [exp], [payment], [discount]);

    // Both should now be exactly 0 paise (fully settled)
    expect(balances.get('Alice')?.netBalancePaise).toBe(0);
    expect(balances.get('Bob')?.netBalancePaise).toBe(0);

    let sum = 0;
    for (const b of balances.values()) {
      sum += b.netBalancePaise;
    }
    expect(sum).toBe(0);
  });

  it('ignores deleted expenses during balance calculation', () => {
    const allMembers = ['Alice', 'Bob'];
    const exp1 = {
      id: 'e1',
      payerMemberId: 'Alice',
      amountPaise: 50000,
      allocations: [{ memberId: 'Bob', sharePaise: 50000 }],
      isDeleted: true, // soft deleted/replaced
    };
    const exp2 = {
      id: 'e2',
      payerMemberId: 'Alice',
      amountPaise: 70000,
      allocations: [{ memberId: 'Bob', sharePaise: 70000 }],
      isDeleted: false,
    };

    const balances = calculateTripNetBalances(allMembers, [exp1, exp2], [], []);
    expect(balances.get('Alice')?.netBalancePaise).toBe(70000);
    expect(balances.get('Bob')?.netBalancePaise).toBe(-70000);
  });
});

describe('Settlement Engine - Debt Simplification', () => {
  it('generates a minimal, deterministic settlement plan', () => {
    const allMembers = ['A', 'B', 'C', 'D'];

    // Net balances:
    // A: +₹650 (65000 paise)
    // B: +₹50 (5000 paise)
    // C: -₹550 (-55000 paise)
    // D: -₹150 (-15000 paise)
    // Total creditors = 70000, total debtors = 70000
    const memberMap = new Map();
    memberMap.set('A', { memberId: 'A', netBalancePaise: 65000 });
    memberMap.set('B', { memberId: 'B', netBalancePaise: 5000 });
    memberMap.set('C', { memberId: 'C', netBalancePaise: -55000 });
    memberMap.set('D', { memberId: 'D', netBalancePaise: -15000 });

    const transfers = calculateSettlementPlan(memberMap);

    // Transfers generated by greedy matching:
    // Largest debtor C (55000) matched with largest creditor A (65000):
    // -> C pays A 55000. (C debt: 0, A credit: 10000)
    // Next debtor D (15000) matched with A (10000):
    // -> D pays A 10000. (A credit: 0, D debt: 5000)
    // D (5000) matched with B (5000):
    // -> D pays B 5000. (D debt: 0, B credit: 0)
    expect(transfers).toHaveLength(3);

    expect(transfers[0]).toEqual({
      fromMemberId: 'C',
      toMemberId: 'A',
      amountPaise: 55000,
    });
    expect(transfers[1]).toEqual({
      fromMemberId: 'D',
      toMemberId: 'A',
      amountPaise: 10000,
    });
    expect(transfers[2]).toEqual({
      fromMemberId: 'D',
      toMemberId: 'B',
      amountPaise: 5000,
    });

    // Invariant: Total transfers to A = 55000 + 10000 = 65000 (A's credit)
    // Total transfers to B = 5000 (B's credit)
    // Total transfers from C = 55000 (C's debt)
    // Total transfers from D = 10000 + 5000 = 15000 (D's debt)
  });

  it('returns empty transfers when all balances are zero', () => {
    const memberMap = new Map();
    memberMap.set('A', { memberId: 'A', netBalancePaise: 0 });
    memberMap.set('B', { memberId: 'B', netBalancePaise: 0 });

    const transfers = calculateSettlementPlan(memberMap);
    expect(transfers).toHaveLength(0);
  });
});

describe('Bilateral Obligations Breakdown', () => {
  it('calculates direct member-to-member breakdown', () => {
    const allMembers = ['A', 'B', 'C'];
    // A paid 300 for B and C (100 each for A, B, C)
    const exp = {
      id: 'e1',
      payerMemberId: 'A',
      amountPaise: 30000,
      allocations: [
        { memberId: 'A', sharePaise: 10000 },
        { memberId: 'B', sharePaise: 10000 },
        { memberId: 'C', sharePaise: 10000 },
      ],
    };

    const obligationsForA = calculateBilateralObligations('A', allMembers, [exp], [], []);
    // B owes A ₹100 (+10000)
    // C owes A ₹100 (+10000)
    expect(obligationsForA.get('B')).toBe(10000);
    expect(obligationsForA.get('C')).toBe(10000);

    const obligationsForB = calculateBilateralObligations('B', allMembers, [exp], [], []);
    // B owes A ₹100 (-10000)
    // B and C have no direct obligation (0)
    expect(obligationsForB.get('A')).toBe(-10000);
    expect(obligationsForB.get('C')).toBe(0);
  });
});
