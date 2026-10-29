import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import {
  calculateTripNetBalances,
  calculateSettlementPlan,
} from '../../src/modules/financial/calculator';
import { SettlementService } from '../../src/modules/settlements/service';
import { TripService } from '../../src/modules/trips/service';
import { UserService } from '../../src/modules/users/service';
import { SUB_RUPEE_DISCOUNT_THRESHOLD_PAISE } from '@tripcircle/contracts';

describe('Financial Reconciliation, Single Source of Truth & Below-₹1 Settlement Waiver', () => {
  let testUserA: any;
  let testUserB: any;
  let testTrip: any;
  let memberA: any;
  let memberB: any;
  let foodCat: any;

  beforeAll(async () => {
    // 1. Setup test users
    const timestamp = Date.now();
    testUserA = await prisma.user.create({
      data: {
        email: `recon_a_${timestamp}@tripcircle.test`,
        name: 'Reconciliation User A',
        passwordHash: 'hashed_pw_test',
        isEmailVerified: true,
      },
    });

    testUserB = await prisma.user.create({
      data: {
        email: `recon_b_${timestamp}@tripcircle.test`,
        name: 'Reconciliation User B',
        passwordHash: 'hashed_pw_test',
        isEmailVerified: true,
      },
    });

    // 2. Fetch category
    foodCat = await prisma.expenseCategory.findFirst({ where: { key: 'FOOD_DINING' } });
    if (!foodCat) {
      foodCat = await prisma.expenseCategory.create({
        data: { key: 'FOOD_DINING', name: 'Food & Dining', icon: 'utensils', isSystem: true },
      });
    }

    // 3. Create test trip
    testTrip = await prisma.trip.create({
      data: {
        name: 'Reconciliation Invariant Trip',
        destination: 'Goa',
        startDate: new Date('2026-11-01'),
        currency: 'INR',
        status: 'ACTIVE',
        creatorId: testUserA.id,
      },
    });

    memberA = await prisma.tripMember.create({
      data: {
        tripId: testTrip.id,
        userId: testUserA.id,
        role: 'CREATOR',
        status: 'ACTIVE',
      },
    });

    memberB = await prisma.tripMember.create({
      data: {
        tripId: testTrip.id,
        userId: testUserB.id,
        role: 'MEMBER',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testTrip) {
      await prisma.ledgerEntry.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.settlementDiscount.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.expenseAllocation.deleteMany({ where: { expense: { tripId: testTrip.id } } });
      await prisma.expenseRevision.deleteMany({ where: { expense: { tripId: testTrip.id } } });
      await prisma.expense.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.payment.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.auditLog.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.tripMember.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.trip.deleteMany({ where: { id: testTrip.id } });
    }
    if (testUserA) await prisma.user.deleteMany({ where: { id: testUserA.id } });
    if (testUserB) await prisma.user.deleteMany({ where: { id: testUserB.id } });
  });

  it('1. Verifies the SUB_RUPEE_DISCOUNT_THRESHOLD_PAISE constant is 100 paise (₹1.00)', () => {
    expect(SUB_RUPEE_DISCOUNT_THRESHOLD_PAISE).toBe(100);
  });

  it('2. Regression Test: ₹203.32 cluster to ₹0.32 cluster transitions and reconciles with profile', async () => {
    // Initial Cluster 1 scenario:
    // Expense: A pays ₹300.00 (30000 paise), split equal (15000 paise each).
    // B owes A 15000 paise.
    // Expense 2: A pays ₹106.64 (10664 paise) for B only.
    // Total debt: B owes A 25664 paise.
    // B makes partial payment: 5332 paise (₹53.32) to A.
    // Remaining debt of B to A: 25664 - 5332 = 20332 paise (₹203.32).
    const exp1 = await prisma.expense.create({
      data: {
        tripId: testTrip.id,
        submitterId: testUserA.id,
        payerMemberId: memberA.id,
        amountPaise: 30000,
        categoryId: foodCat.id,
        description: 'Cluster 1 Dinner',
        splitMethod: 'EQUAL',
        version: 1,
        allocations: {
          create: [
            { memberId: memberA.id, sharePaise: 15000 },
            { memberId: memberB.id, sharePaise: 15000 },
          ],
        },
      },
    });

    const exp2 = await prisma.expense.create({
      data: {
        tripId: testTrip.id,
        submitterId: testUserA.id,
        payerMemberId: memberA.id,
        amountPaise: 10664,
        categoryId: foodCat.id,
        description: 'Cluster 1 Extra for B',
        splitMethod: 'UNEQUAL',
        version: 1,
        allocations: {
          create: [{ memberId: memberB.id, sharePaise: 10664 }],
        },
      },
    });

    const pay1 = await prisma.payment.create({
      data: {
        tripId: testTrip.id,
        payerMemberId: memberB.id,
        receiverMemberId: memberA.id,
        amountPaise: 5332,
        paymentMethod: 'UPI',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // Check balance at Cluster 1
    const tripDetail1 = await TripService.getTripDetail(testTrip.id, testUserA.id);
    expect(tripDetail1.userNetBalancePaise).toBe(20332); // Exactly ₹203.32

    const profile1 = await UserService.getProfile(testUserA.id);
    expect(profile1.netUnsettledPaise).toBe(20332); // Profile and trip agree 100%!

    // Now Cluster 2 occurs: B pays ₹203.00 (20300 paise) to A
    const pay2 = await prisma.payment.create({
      data: {
        tripId: testTrip.id,
        payerMemberId: memberB.id,
        receiverMemberId: memberA.id,
        amountPaise: 20300,
        paymentMethod: 'UPI',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // Verify balance at Cluster 2: 20332 - 20300 = 32 paise (₹0.32)
    const tripDetail2 = await TripService.getTripDetail(testTrip.id, testUserA.id);
    expect(tripDetail2.userNetBalancePaise).toBe(32); // Exactly ₹0.32

    // Authoritative profile service reflects the exact live balance
    const profile2 = await UserService.getProfile(testUserA.id);
    expect(profile2.netUnsettledPaise).toBe(32); // Profile matches ₹0.32! Zero discrepancy!
  });

  it('3. Auto-applies Below-₹1.00 Settlement Waiver for 32 paise residual balance', async () => {
    // Calling getSettlementPlan should detect that B owes A 32 paise (< 100 paise)
    // with no pending/disputed payments, and automatically record the waiver!
    const plan = await SettlementService.getSettlementPlan(testTrip.id, testUserA.id);

    // After sub-rupee waiver:
    expect(plan.isSettled).toBe(true);
    expect(plan.currentUserNetBalancePaise).toBe(0); // 32 paise waived to 0
    expect(plan.simplifiedTransfers).toHaveLength(0); // No tiny 32-paise cash transfers required

    // Verify an accepted settlement discount was recorded in the database
    const discounts = await prisma.settlementDiscount.findMany({
      where: { tripId: testTrip.id, status: 'ACCEPTED' },
    });
    expect(discounts.length).toBeGreaterThanOrEqual(1);

    const waiver = discounts.find((d) => d.waivedPaise === 32);
    expect(waiver).toBeDefined();
    expect(waiver?.fromMemberId).toBe(memberB.id); // debtor
    expect(waiver?.toMemberId).toBe(memberA.id); // creditor who waived
    expect(waiver?.reason).toContain('< ₹1.00');

    // Dual ledger entries created
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { referenceId: waiver?.id },
    });
    expect(ledgerEntries).toHaveLength(2);

    // Trip detail & profile now reflect 0 net unsettled
    const finalDetail = await TripService.getTripDetail(testTrip.id, testUserA.id);
    expect(finalDetail.userNetBalancePaise).toBe(0);

    const finalProfile = await UserService.getProfile(testUserA.id);
    expect(finalProfile.netUnsettledPaise).toBe(0);
  });

  it('4. Idempotency: Multiple settlement calls do not duplicate waivers or ledger entries', async () => {
    const discountsBefore = await prisma.settlementDiscount.findMany({
      where: { tripId: testTrip.id, status: 'ACCEPTED' },
    });

    // Call settlement plan multiple times
    await SettlementService.getSettlementPlan(testTrip.id, testUserA.id);
    await SettlementService.getSettlementPlan(testTrip.id, testUserB.id);
    await SettlementService.autoApplySubRupeeDiscounts(testTrip.id);

    const discountsAfter = await prisma.settlementDiscount.findMany({
      where: { tripId: testTrip.id, status: 'ACCEPTED' },
    });

    expect(discountsAfter.length).toBe(discountsBefore.length);
  });

  it('5. Boundary Tests: 99 paise qualifies for waiver, 100 paise and above does NOT', () => {
    const members = ['m1', 'm2'];

    // Test 99 paise residual
    const b99 = calculateTripNetBalances(
      members,
      [{ id: 'e1', payerMemberId: 'm1', amountPaise: 99, allocations: [{ memberId: 'm2', sharePaise: 99 }] }],
      [],
      []
    );
    const plan99 = calculateSettlementPlan(b99);
    expect(plan99[0].amountPaise).toBe(99);
    expect(plan99[0].amountPaise < SUB_RUPEE_DISCOUNT_THRESHOLD_PAISE).toBe(true);

    // Test 100 paise residual (₹1.00)
    const b100 = calculateTripNetBalances(
      members,
      [{ id: 'e2', payerMemberId: 'm1', amountPaise: 100, allocations: [{ memberId: 'm2', sharePaise: 100 }] }],
      [],
      []
    );
    const plan100 = calculateSettlementPlan(b100);
    expect(plan100[0].amountPaise).toBe(100);
    expect(plan100[0].amountPaise < SUB_RUPEE_DISCOUNT_THRESHOLD_PAISE).toBe(false); // Exactly ₹1.00 is NOT waived

    // Test 101 paise residual (₹1.01)
    const b101 = calculateTripNetBalances(
      members,
      [{ id: 'e3', payerMemberId: 'm1', amountPaise: 101, allocations: [{ memberId: 'm2', sharePaise: 101 }] }],
      [],
      []
    );
    const plan101 = calculateSettlementPlan(b101);
    expect(plan101[0].amountPaise).toBe(101);
    expect(plan101[0].amountPaise < SUB_RUPEE_DISCOUNT_THRESHOLD_PAISE).toBe(false);
  });
});
