import { prisma } from '../../lib/prisma';
import { CreateExpenseInput, EditExpenseInput } from '@tripcircle/contracts';
import { calculateEqualSplit, validateUnequalSplit } from '../financial/calculator';
import { createOutboxEvent } from '../../lib/outbox';

export class ExpenseService {
  static async createExpense(tripId: string, currentUserId: string, input: CreateExpenseInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify submitter is active member
      const submitterMember = await tx.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId: currentUserId } },
        include: { user: true },
      });

      if (!submitterMember || submitterMember.status !== 'ACTIVE') {
        throw new Error('Forbidden: Only active members can submit expenses');
      }

      // 2. Verify trip is ACTIVE
      const trip = await tx.trip.findUnique({ where: { id: tripId } });
      if (!trip || trip.status === 'CLOSED') {
        throw new Error('Cannot add expenses to a closed trip');
      }

      // 3. Verify payer is a trip member
      const payer = await tx.tripMember.findUnique({
        where: { id: input.payerMemberId },
      });
      if (!payer || payer.tripId !== tripId) {
        throw new Error('Invalid payer: member not found in this trip');
      }

      // 4. Calculate or validate allocations
      let calculatedAllocations: { memberId: string; sharePaise: number }[] = [];

      if (input.splitMethod === 'EQUAL') {
        const beneficiaryIds = input.allocations.map((a) => a.memberId);
        calculatedAllocations = calculateEqualSplit(input.amountPaise, beneficiaryIds);
      } else {
        calculatedAllocations = validateUnequalSplit(input.amountPaise, input.allocations);
      }

      // Verify all beneficiaries are members of this trip
      for (const a of calculatedAllocations) {
        const bm = await tx.tripMember.findUnique({ where: { id: a.memberId } });
        if (!bm || bm.tripId !== tripId) {
          throw new Error(`Beneficiary member ${a.memberId} is not a valid member of this trip`);
        }
      }

      // 5. Create expense record
      const expense = await tx.expense.create({
        data: {
          tripId,
          submitterId: currentUserId,
          payerMemberId: input.payerMemberId,
          amountPaise: input.amountPaise,
          categoryId: input.categoryId,
          description: input.description,
          note: input.note,
          location: input.location,
          expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
          receiptUrl: input.receiptUrl,
          splitMethod: input.splitMethod,
          version: 1,
          allocations: {
            create: calculatedAllocations.map((a) => ({
              memberId: a.memberId,
              sharePaise: a.sharePaise,
            })),
          },
        },
        include: {
          allocations: {
            include: {
              member: { include: { user: true } },
            },
          },
          payerMember: { include: { user: true } },
          category: true,
        },
      });

      // 6. Create initial revision record
      await tx.expenseRevision.create({
        data: {
          expenseId: expense.id,
          version: 1,
          editorId: currentUserId,
          amountPaise: input.amountPaise,
          payerMemberId: input.payerMemberId,
          categoryId: input.categoryId,
          description: input.description,
          note: input.note,
          location: input.location,
          receiptUrl: input.receiptUrl,
          splitMethod: input.splitMethod,
          allocationsSnapshot: calculatedAllocations,
        },
      });

      // 7. Create ledger entries: credit payer, debit beneficiaries
      // Credit payer
      await tx.ledgerEntry.create({
        data: {
          tripId,
          eventType: 'EXPENSE_CREATED',
          referenceId: expense.id,
          memberId: input.payerMemberId,
          creditPaise: input.amountPaise,
          debitPaise: 0,
          netChangePaise: input.amountPaise,
          balanceAfterPaise: 0, // transient snapshot
          description: `Paid for expense: ${expense.description}`,
        },
      });

      // Debit beneficiaries
      for (const a of calculatedAllocations) {
        await tx.ledgerEntry.create({
          data: {
            tripId,
            eventType: 'EXPENSE_CREATED',
            referenceId: expense.id,
            memberId: a.memberId,
            creditPaise: 0,
            debitPaise: a.sharePaise,
            netChangePaise: -a.sharePaise,
            balanceAfterPaise: 0,
            description: `Share for expense: ${expense.description}`,
          },
        });
      }

      // 8. Create transactional outbox event
      await createOutboxEvent(tx, 'EXPENSE', expense.id, 'EXPENSE_CREATED', {
        expenseId: expense.id,
        tripId,
        amountPaise: expense.amountPaise,
        description: expense.description,
        payerName: expense.payerMember.user.name,
      });

      // 9. Create in-app notifications for other trip members
      const otherMembers = await tx.tripMember.findMany({
        where: {
          tripId,
          userId: { not: currentUserId },
          status: 'ACTIVE',
        },
      });

      for (const m of otherMembers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            tripId,
            type: 'NEW_EXPENSE',
            title: `New Expense: ${expense.description}`,
            body: `${submitterMember.user.name} added ₹${(expense.amountPaise / 100).toFixed(2)} for ${expense.description}.`,
            data: { expenseId: expense.id, tripId },
          },
        });
      }

      return expense;
    });
  }

  static async editExpense(
    tripId: string,
    expenseId: string,
    currentUserId: string,
    input: EditExpenseInput
  ) {
    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({
        where: { id: expenseId },
        include: { payerMember: true },
      });

      if (!expense || expense.tripId !== tripId) {
        throw new Error('Expense not found');
      }

      if (expense.isDeleted) {
        throw new Error('Cannot edit a deleted expense');
      }

      // Optimistic concurrency control check
      if (expense.version !== input.expectedVersion) {
        throw new Error(
          `Conflict: This expense has been modified by someone else (current version: ${expense.version}, expected: ${input.expectedVersion}). Please refresh and try again.`
        );
      }

      // Check authorization (submitter or trip creator)
      const currentMember = await tx.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId: currentUserId } },
      });

      if (!currentMember || (expense.submitterId !== currentUserId && currentMember.role !== 'CREATOR')) {
        throw new Error('Forbidden: You can only edit expenses you submitted');
      }

      // Calculate or validate allocations
      let calculatedAllocations: { memberId: string; sharePaise: number }[] = [];
      if (input.splitMethod === 'EQUAL') {
        const beneficiaryIds = input.allocations.map((a) => a.memberId);
        calculatedAllocations = calculateEqualSplit(input.amountPaise, beneficiaryIds);
      } else {
        calculatedAllocations = validateUnequalSplit(input.amountPaise, input.allocations);
      }

      const nextVersion = expense.version + 1;

      // 1. Save new revision
      await tx.expenseRevision.create({
        data: {
          expenseId: expense.id,
          version: nextVersion,
          editorId: currentUserId,
          amountPaise: input.amountPaise,
          payerMemberId: input.payerMemberId,
          categoryId: input.categoryId,
          description: input.description,
          note: input.note,
          location: input.location,
          receiptUrl: input.receiptUrl,
          splitMethod: input.splitMethod,
          allocationsSnapshot: calculatedAllocations,
          changeReason: input.changeReason,
        },
      });

      // 2. Remove old allocations and add new allocations
      await tx.expenseAllocation.deleteMany({
        where: { expenseId: expense.id },
      });

      await tx.expenseAllocation.createMany({
        data: calculatedAllocations.map((a) => ({
          expenseId: expense.id,
          memberId: a.memberId,
          sharePaise: a.sharePaise,
        })),
      });

      // 3. Update current expense
      const updatedExpense = await tx.expense.update({
        where: { id: expense.id },
        data: {
          payerMemberId: input.payerMemberId,
          amountPaise: input.amountPaise,
          categoryId: input.categoryId,
          description: input.description,
          note: input.note,
          location: input.location,
          receiptUrl: input.receiptUrl,
          splitMethod: input.splitMethod,
          version: nextVersion,
          ...(input.expenseDate ? { expenseDate: new Date(input.expenseDate) } : {}),
        },
        include: {
          allocations: {
            include: { member: { include: { user: true } } },
          },
          payerMember: { include: { user: true } },
          category: true,
        },
      });

      // 4. Record ledger entry for the edit
      await tx.ledgerEntry.create({
        data: {
          tripId,
          eventType: 'EXPENSE_EDITED',
          referenceId: expense.id,
          memberId: input.payerMemberId,
          creditPaise: input.amountPaise,
          debitPaise: 0,
          netChangePaise: input.amountPaise - expense.amountPaise,
          balanceAfterPaise: 0,
          description: `Updated expense: ${input.description} (v${nextVersion})`,
        },
      });

      // 5. Outbox & Notifications
      await createOutboxEvent(tx, 'EXPENSE', expense.id, 'EXPENSE_EDITED', {
        expenseId: expense.id,
        tripId,
        newVersion: nextVersion,
        amountPaise: input.amountPaise,
      });

      return updatedExpense;
    });
  }

  static async listExpenses(tripId: string) {
    const expenses = await prisma.expense.findMany({
      where: {
        tripId,
        isDeleted: false,
      },
      include: {
        category: true,
        payerMember: { include: { user: true } },
        submitter: { select: { id: true, name: true, email: true } },
        allocations: {
          include: { member: { include: { user: true } } },
        },
      },
      orderBy: { expenseDate: 'desc' },
    });

    return expenses;
  }

  static async getExpenseDetail(tripId: string, expenseId: string) {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        category: true,
        payerMember: { include: { user: true } },
        submitter: { select: { id: true, name: true, email: true } },
        allocations: {
          include: { member: { include: { user: true } } },
        },
        revisions: {
          include: { editor: { select: { id: true, name: true, email: true } } },
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!expense || expense.tripId !== tripId) {
      throw new Error('Expense not found');
    }

    return expense;
  }
}
