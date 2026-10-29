import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { CreateExpenseSchema, EditExpenseSchema } from '@tripcircle/contracts';
import { ExpenseService, normalizeExpenseDescription } from '../../src/modules/expenses/service';
import { TripService } from '../../src/modules/trips/service';
import { AuthService } from '../../src/modules/auth/service';

describe('P0: Optional Expense Description End-to-End', () => {
  let testUserA: any;
  let testUserB: any;
  let foodCategory: any;
  let testTrip: any;
  let memberA: any;
  let memberB: any;

  beforeAll(async () => {
    // 1. Seed category
    foodCategory = await prisma.expenseCategory.upsert({
      where: { key: 'OPT_DESC_FOOD' },
      update: {},
      create: {
        key: 'OPT_DESC_FOOD',
        name: 'Dining & Drinks',
        icon: 'restaurant',
      },
    });

    // 2. Register test users
    const timestamp = Date.now();
    const resA = await AuthService.register({
      name: 'Desc Test User A',
      email: `desca_${timestamp}@tripcircle.test`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/qr-a.png',
    });
    testUserA = { id: resA.userId, email: resA.email };

    const resB = await AuthService.register({
      name: 'Desc Test User B',
      email: `descb_${timestamp}@tripcircle.test`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/qr-b.png',
    });
    testUserB = { id: resB.userId, email: resB.email };

    // 3. Create test trip with both members
    testTrip = await TripService.createTrip(testUserA.id, {
      name: 'Optional Description Test Trip',
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
  });

  afterAll(async () => {
    // Cleanup created records safely
    await prisma.notification.deleteMany({ where: { tripId: testTrip.id } });
    await prisma.ledgerEntry.deleteMany({ where: { tripId: testTrip.id } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: testTrip.id } });
    await prisma.expenseAllocation.deleteMany({ where: { expense: { tripId: testTrip.id } } });
    await prisma.expenseRevision.deleteMany({ where: { expense: { tripId: testTrip.id } } });
    await prisma.expense.deleteMany({ where: { tripId: testTrip.id } });
    await prisma.tripMember.deleteMany({ where: { tripId: testTrip.id } });
    await prisma.trip.deleteMany({ where: { id: testTrip.id } });
    await prisma.user.deleteMany({ where: { id: { in: [testUserA.id, testUserB.id] } } });
    await prisma.expenseCategory.deleteMany({ where: { id: foodCategory.id } });
  });

  describe('1. Shared Contract Schema Validation', () => {
    const basePayload = {
      payerMemberId: 'mem_1',
      amountPaise: 10000,
      categoryId: 'cat_1',
      splitMethod: 'EQUAL' as const,
      allocations: [
        { memberId: 'mem_1', sharePaise: 5000 },
        { memberId: 'mem_2', sharePaise: 5000 },
      ],
    };

    it('accepts an omitted description', () => {
      const parsed = CreateExpenseSchema.safeParse({ ...basePayload });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.description).toBeUndefined();
      }
    });

    it('accepts an explicitly empty string description', () => {
      const parsed = CreateExpenseSchema.safeParse({ ...basePayload, description: '' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.description).toBe('');
      }
    });

    it('accepts a whitespace-only description', () => {
      const parsed = CreateExpenseSchema.safeParse({ ...basePayload, description: '    ' });
      expect(parsed.success).toBe(true);
    });

    it('accepts a valid non-empty description', () => {
      const parsed = CreateExpenseSchema.safeParse({ ...basePayload, description: 'Seafood Buffet' });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.description).toBe('Seafood Buffet');
      }
    });

    it('accepts description at maximum allowed length (200 characters)', () => {
      const maxDesc = 'A'.repeat(200);
      const parsed = CreateExpenseSchema.safeParse({ ...basePayload, description: maxDesc });
      expect(parsed.success).toBe(true);
    });

    it('rejects description exceeding 200 characters', () => {
      const overMaxDesc = 'A'.repeat(201);
      const parsed = CreateExpenseSchema.safeParse({ ...basePayload, description: overMaxDesc });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.errors[0].message).toContain('cannot exceed 200 characters');
      }
    });

    it('validates EditExpenseSchema with optional description', () => {
      const editPayload = {
        ...basePayload,
        expectedVersion: 1,
      };
      const omitted = EditExpenseSchema.safeParse(editPayload);
      expect(omitted.success).toBe(true);

      const empty = EditExpenseSchema.safeParse({ ...editPayload, description: '' });
      expect(empty.success).toBe(true);

      const tooLong = EditExpenseSchema.safeParse({ ...editPayload, description: 'B'.repeat(201) });
      expect(tooLong.success).toBe(false);
    });
  });

  describe('2. Backend Normalization Logic', () => {
    it('normalizes non-empty description by trimming whitespace', () => {
      const normalized = normalizeExpenseDescription('   Goa Shack Dinner   ', 'Food');
      expect(normalized).toBe('Goa Shack Dinner');
    });

    it('falls back to category name when description is omitted or empty', () => {
      expect(normalizeExpenseDescription(undefined, 'Dining & Drinks')).toBe('Dining & Drinks');
      expect(normalizeExpenseDescription('', 'Dining & Drinks')).toBe('Dining & Drinks');
      expect(normalizeExpenseDescription('   ', 'Dining & Drinks')).toBe('Dining & Drinks');
    });

    it('falls back to "Expense" when both description and category name are missing', () => {
      expect(normalizeExpenseDescription(undefined, undefined)).toBe('Expense');
      expect(normalizeExpenseDescription('', '')).toBe('Expense');
      expect(normalizeExpenseDescription('   ', '   ')).toBe('Expense');
    });

    it('preserves existing description when editing if description is undefined', () => {
      const preserved = normalizeExpenseDescription(undefined, 'Dining & Drinks', 'Original Dinner');
      expect(preserved).toBe('Original Dinner');
    });

    it('clears to category name when explicitly cleared during edit', () => {
      const cleared = normalizeExpenseDescription('', 'Dining & Drinks', 'Original Dinner');
      expect(cleared).toBe('Dining & Drinks');
    });
  });

  describe('3. Service End-to-End: Expense Creation without Description', () => {
    it('persists expense, revision, ledger, outbox, and notifications with normalized category fallback', async () => {
      const createdExpense = await ExpenseService.createExpense(testTrip.id, testUserA.id, {
        payerMemberId: memberA.id,
        amountPaise: 4000,
        categoryId: foodCategory.id,
        splitMethod: 'EQUAL',
        allocations: [
          { memberId: memberA.id, sharePaise: 2000 },
          { memberId: memberB.id, sharePaise: 2000 },
        ],
        // description intentionally omitted!
      });

      // A. Verify Expense record
      expect(createdExpense.id).toBeDefined();
      expect(createdExpense.description).toBe('Dining & Drinks');

      // B. Verify ExpenseRevision record
      const revision = await prisma.expenseRevision.findFirst({
        where: { expenseId: createdExpense.id, version: 1 },
      });
      expect(revision).toBeDefined();
      expect(revision?.description).toBe('Dining & Drinks');

      // C. Verify Ledger entries
      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: { referenceId: createdExpense.id },
      });
      expect(ledgerEntries.length).toBe(3); // 1 payer credit, 2 beneficiary debits
      for (const entry of ledgerEntries) {
        expect(entry.description).toContain('Dining & Drinks');
      }

      // D. Verify Outbox event
      const outboxEvent = await prisma.outboxEvent.findFirst({
        where: { aggregateId: createdExpense.id, eventType: 'EXPENSE_CREATED' },
      });
      expect(outboxEvent).toBeDefined();
      const payload = outboxEvent?.payload as any;
      expect(payload.description).toBe('Dining & Drinks');

      // E. Verify Notification for member B
      const notification = await prisma.notification.findFirst({
        where: { tripId: testTrip.id, userId: testUserB.id, type: 'NEW_EXPENSE' },
      });
      expect(notification).toBeDefined();
      expect(notification?.title).toBe('New Expense: Dining & Drinks');
      expect(notification?.body).toContain('added ₹40.00 for Dining & Drinks');
    });
  });

  describe('4. Service End-to-End: Expense Editing without Description', () => {
    it('preserves existing description if omitted in edit, or updates to category if cleared', async () => {
      // 1. Create with explicit description
      const expense = await ExpenseService.createExpense(testTrip.id, testUserA.id, {
        payerMemberId: memberA.id,
        amountPaise: 6000,
        categoryId: foodCategory.id,
        description: 'Original Seafood Dinner',
        splitMethod: 'EQUAL',
        allocations: [
          { memberId: memberA.id, sharePaise: 3000 },
          { memberId: memberB.id, sharePaise: 3000 },
        ],
      });

      expect(expense.description).toBe('Original Seafood Dinner');

      // 2. Edit without passing description (undefined) -> must preserve existing
      const editedPreserved = await ExpenseService.editExpense(testTrip.id, expense.id, testUserA.id, {
        payerMemberId: memberA.id,
        amountPaise: 8000,
        categoryId: foodCategory.id,
        splitMethod: 'EQUAL',
        allocations: [
          { memberId: memberA.id, sharePaise: 4000 },
          { memberId: memberB.id, sharePaise: 4000 },
        ],
        expectedVersion: 1,
      });

      expect(editedPreserved.description).toBe('Original Seafood Dinner');
      expect(editedPreserved.version).toBe(2);

      // 3. Edit and explicitly clear description ("") -> must normalize to category
      const editedCleared = await ExpenseService.editExpense(testTrip.id, expense.id, testUserA.id, {
        payerMemberId: memberA.id,
        description: '   ',
        amountPaise: 8000,
        categoryId: foodCategory.id,
        splitMethod: 'EQUAL',
        allocations: [
          { memberId: memberA.id, sharePaise: 4000 },
          { memberId: memberB.id, sharePaise: 4000 },
        ],
        expectedVersion: 2,
      });

      expect(editedCleared.description).toBe('Dining & Drinks');
      expect(editedCleared.version).toBe(3);
    });
  });
});
