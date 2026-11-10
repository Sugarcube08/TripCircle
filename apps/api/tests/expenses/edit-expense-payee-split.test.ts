import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { ExpenseService } from '../../src/modules/expenses/service';
import { TripService } from '../../src/modules/trips/service';
import { AuthService } from '../../src/modules/auth/service';

describe('Edit Expense: Payee, Split Method, and Allocations', () => {
  let testUserA: any;
  let testUserB: any;
  let testUserC: any;
  let categoryA: any;
  let categoryB: any;
  let testTrip: any;
  let memberA: any;
  let memberB: any;
  let memberC: any;

  beforeAll(async () => {
    // 1. Seed categories
    categoryA = await prisma.expenseCategory.upsert({
      where: { key: 'TEST_EDIT_FOOD' },
      update: {},
      create: { key: 'TEST_EDIT_FOOD', name: 'Food & Dining', icon: 'restaurant' },
    });
    categoryB = await prisma.expenseCategory.upsert({
      where: { key: 'TEST_EDIT_TRAVEL' },
      update: {},
      create: { key: 'TEST_EDIT_TRAVEL', name: 'Travel & Transport', icon: 'car' },
    });

    // 2. Register 3 users
    const ts = Date.now();
    const resA = await AuthService.register({
      name: 'Edit Tester A',
      email: `edita_${ts}@tripcircle.test`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/qr-a.png',
    });
    testUserA = { id: resA.userId, email: resA.email };

    const resB = await AuthService.register({
      name: 'Edit Tester B',
      email: `editb_${ts}@tripcircle.test`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/qr-b.png',
    });
    testUserB = { id: resB.userId, email: resB.email };

    const resC = await AuthService.register({
      name: 'Edit Tester C',
      email: `editc_${ts}@tripcircle.test`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/qr-c.png',
    });
    testUserC = { id: resC.userId, email: resC.email };

    // 3. Create trip with all 3 members
    testTrip = await TripService.createTrip(testUserA.id, {
      name: 'Edit Expense Verification Trip',
      currency: 'INR',
      startDate: new Date().toISOString(),
    });

    memberA = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId: testTrip.id, userId: testUserA.id } },
    });

    memberB = await prisma.tripMember.create({
      data: {
        tripId: testTrip.id,
        userId: testUserB.id,
        role: 'MEMBER',
        status: 'ACTIVE',
      },
    });

    memberC = await prisma.tripMember.create({
      data: {
        tripId: testTrip.id,
        userId: testUserC.id,
        role: 'MEMBER',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    if (testTrip?.id) {
      await prisma.notification.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.ledgerEntry.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: testTrip.id } });
      await prisma.expenseAllocation.deleteMany({ where: { expense: { tripId: testTrip.id } } });
      await prisma.expenseRevision.deleteMany({ where: { expense: { tripId: testTrip.id } } });
      await prisma.expense.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.tripMember.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.trip.deleteMany({ where: { id: testTrip.id } });
    }
    const userIds = [testUserA?.id, testUserB?.id, testUserC?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const catIds = [categoryA?.id, categoryB?.id].filter(Boolean);
    if (catIds.length > 0) {
      await prisma.expenseCategory.deleteMany({ where: { id: { in: catIds } } });
    }
  });

  it('updates payerMemberId, splitMethod, and unequal allocations while preserving zero-sum balance', async () => {
    // Step 1: Create expense where Member A pays 6000 paise (₹60), split EQUALLY between A and B
    const createdExpense = await ExpenseService.createExpense(testTrip.id, testUserA.id, {
      payerMemberId: memberA.id,
      amountPaise: 6000,
      categoryId: categoryA.id,
      description: 'Initial Dinner',
      splitMethod: 'EQUAL',
      allocations: [
        { memberId: memberA.id, sharePaise: 3000 },
        { memberId: memberB.id, sharePaise: 3000 },
      ],
    });

    expect(createdExpense.version).toBe(1);
    expect(createdExpense.payerMemberId).toBe(memberA.id);
    expect(createdExpense.splitMethod).toBe('EQUAL');

    // Verify initial ledger balance:
    const initialLedger = await prisma.ledgerEntry.findMany({
      where: { tripId: testTrip.id, referenceId: createdExpense.id },
    });
    const netAInitial = initialLedger
      .filter((e) => e.memberId === memberA.id)
      .reduce((acc, e) => acc + e.creditPaise - e.debitPaise, 0);
    const netBInitial = initialLedger
      .filter((e) => e.memberId === memberB.id)
      .reduce((acc, e) => acc + e.creditPaise - e.debitPaise, 0);

    expect(netAInitial).toBe(3000); // paid 6000, owes 3000 => net +3000
    expect(netBInitial).toBe(-3000); // paid 0, owes 3000 => net -3000

    // Step 2: Edit expense:
    // Change Payer to Member B
    // Change Split Method to UNEQUAL among A, B, and C
    // Change Amount to 12000 paise (₹120)
    // Allocations: A = 5000, B = 4000, C = 3000 (total = 12000)
    // Change Category to categoryB
    const editedExpense = await ExpenseService.editExpense(
      testTrip.id,
      createdExpense.id,
      testUserA.id,
      {
        payerMemberId: memberB.id,
        amountPaise: 12000,
        categoryId: categoryB.id,
        description: 'Updated Dinner & Transport',
        splitMethod: 'UNEQUAL',
        allocations: [
          { memberId: memberA.id, sharePaise: 5000 },
          { memberId: memberB.id, sharePaise: 4000 },
          { memberId: memberC.id, sharePaise: 3000 },
        ],
        expectedVersion: 1,
        changeReason: 'Member B actually paid, added Member C share',
      }
    );

    expect(editedExpense.version).toBe(2);
    expect(editedExpense.payerMemberId).toBe(memberB.id);
    expect(editedExpense.splitMethod).toBe('UNEQUAL');
    expect(editedExpense.amountPaise).toBe(12000);
    expect(editedExpense.categoryId).toBe(categoryB.id);
    expect(editedExpense.allocations).toHaveLength(3);

    // Step 3: Check all ledger entries for this trip to verify financial invariants:
    const allLedger = await prisma.ledgerEntry.findMany({
      where: { tripId: testTrip.id },
    });

    const netA = allLedger
      .filter((e) => e.memberId === memberA.id)
      .reduce((acc, e) => acc + e.creditPaise - e.debitPaise, 0);
    const netB = allLedger
      .filter((e) => e.memberId === memberB.id)
      .reduce((acc, e) => acc + e.creditPaise - e.debitPaise, 0);
    const netC = allLedger
      .filter((e) => e.memberId === memberC.id)
      .reduce((acc, e) => acc + e.creditPaise - e.debitPaise, 0);

    // Member B paid 12000, owes 4000 => net +8000
    // Member A paid 0, owes 5000 => net -5000
    // Member C paid 0, owes 3000 => net -3000
    expect(netB).toBe(8000);
    expect(netA).toBe(-5000);
    expect(netC).toBe(-3000);

    // Zero-sum invariant:
    expect(netA + netB + netC).toBe(0);

    // Step 4: Verify revision history
    const revisions = await prisma.expenseRevision.findMany({
      where: { expenseId: createdExpense.id },
      orderBy: { version: 'asc' },
    });
    expect(revisions).toHaveLength(2); // v1 (created) and v2 (edited)
    expect(revisions[0].version).toBe(1);
    expect(revisions[0].payerMemberId).toBe(memberA.id);
    expect(revisions[1].version).toBe(2);
    expect(revisions[1].payerMemberId).toBe(memberB.id);
    expect(revisions[1].amountPaise).toBe(12000);
    expect(revisions[1].splitMethod).toBe('UNEQUAL');
    expect(revisions[1].changeReason).toBe('Member B actually paid, added Member C share');
  });

  it('rejects an edit with a stale expectedVersion (optimistic locking)', async () => {
    const expense = await ExpenseService.createExpense(testTrip.id, testUserA.id, {
      payerMemberId: memberA.id,
      amountPaise: 4000,
      categoryId: categoryA.id,
      description: 'Concurrency Test',
      splitMethod: 'EQUAL',
      allocations: [
        { memberId: memberA.id, sharePaise: 2000 },
        { memberId: memberB.id, sharePaise: 2000 },
      ],
    });

    // Valid edit to version 2
    await ExpenseService.editExpense(testTrip.id, expense.id, testUserA.id, {
      payerMemberId: memberA.id,
      amountPaise: 5000,
      categoryId: categoryA.id,
      description: 'First Edit',
      splitMethod: 'EQUAL',
      allocations: [
        { memberId: memberA.id, sharePaise: 2500 },
        { memberId: memberB.id, sharePaise: 2500 },
      ],
      expectedVersion: 1,
    });

    // Stale edit attempting to use expectedVersion: 1 again
    await expect(
      ExpenseService.editExpense(testTrip.id, expense.id, testUserA.id, {
        payerMemberId: memberB.id,
        amountPaise: 5000,
        categoryId: categoryA.id,
        description: 'Stale Edit',
        splitMethod: 'EQUAL',
        allocations: [
          { memberId: memberA.id, sharePaise: 2500 },
          { memberId: memberB.id, sharePaise: 2500 },
        ],
        expectedVersion: 1,
      })
    ).rejects.toThrow(/Conflict: This expense has been modified/);
  });
});
