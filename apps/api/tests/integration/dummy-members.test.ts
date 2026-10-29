import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { AuthService } from '../../src/modules/auth/service';
import { TripService } from '../../src/modules/trips/service';
import { MembershipService } from '../../src/modules/memberships/service';
import { ExpenseService } from '../../src/modules/expenses/service';
import { PaymentService } from '../../src/modules/payments/service';
import { SettlementService } from '../../src/modules/settlements/service';

describe('First-Class Dummy Members & Replacement Integration Tests', () => {
  let userA: any;
  let userB: any;
  let userR: any; // Registered user who will replace dummy member
  let trip: any;
  let dummyMemberRohan: any;
  let dummyMemberPriya: any;
  let memberA: any;
  let memberB: any;
  let foodCategory: any;

  beforeAll(async () => {
    // 1. Seed food category
    foodCategory = await prisma.expenseCategory.upsert({
      where: { key: 'FOOD' },
      update: {},
      create: { key: 'FOOD', name: 'Food & Dining', icon: 'restaurant' },
    });

    // 2. Register users
    const resA = await AuthService.register({
      name: 'Alice Creator',
      email: `alice.dummy.${Date.now()}@example.com`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/alice-qr.png',
    });
    userA = { id: resA.userId, email: resA.email, name: resA.name };

    const resB = await AuthService.register({
      name: 'Bob Registered',
      email: `bob.dummy.${Date.now()}@example.com`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/bob-qr.png',
    });
    userB = { id: resB.userId, email: resB.email, name: resB.name };

    const resR = await AuthService.register({
      name: 'Rohan Sharma (Official)',
      email: `rohan.official.${Date.now()}@example.com`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/rohan-qr.png',
    });
    userR = { id: resR.userId, email: resR.email, name: resR.name };
  });

  afterAll(async () => {
    if (trip?.id) {
      await prisma.trip.delete({ where: { id: trip.id } }).catch(() => {});
    }
    const userIds = [userA?.id, userB?.id, userR?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
  });

  it('Step 1: Creator creates a trip and invites registered user B', async () => {
    trip = await TripService.createTrip(userA.id, {
      name: 'Goa Weekend 2026',
      startDate: new Date().toISOString(),
      currency: 'INR',
    });

    expect(trip).toBeDefined();
    expect(trip.name).toBe('Goa Weekend 2026');

    memberA = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId: trip.id, userId: userA.id } },
    });
    expect(memberA).toBeDefined();
    expect(memberA.role).toBe('CREATOR');

    // Invite User B and accept
    const inviteB = await MembershipService.inviteMember(trip.id, userA.id, {
      userIdOrEmail: userB.email,
    });
    const acceptedB = await MembershipService.respondInvite(inviteB.id, userB.id, { action: 'ACCEPT' });
    memberB = acceptedB;
    expect(memberB.status).toBe('ACTIVE');
  });

  it('Step 2: Add offline/dummy members without user accounts', async () => {
    dummyMemberRohan = await MembershipService.addDummyMember(trip.id, userA.id, {
      name: 'Rohan Sharma',
      phone: '+919876543210',
    });

    expect(dummyMemberRohan.isDummy).toBe(true);
    expect(dummyMemberRohan.userId).toBeNull();
    expect(dummyMemberRohan.displayName).toBe('Rohan Sharma');
    expect(dummyMemberRohan.status).toBe('ACTIVE');

    dummyMemberPriya = await MembershipService.addDummyMember(trip.id, userA.id, {
      name: 'Priya Verma',
      email: 'priya.offline@example.com',
    });

    expect(dummyMemberPriya.isDummy).toBe(true);
    expect(dummyMemberPriya.userId).toBeNull();
    expect(dummyMemberPriya.displayName).toBe('Priya Verma');
  });

  it('Step 3: Dummy members participate in equal and unequal expense splits', async () => {
    // A pays ₹3,000 (300000 paise) split equally among A, Rohan, and Priya (100000 paise each)
    const expense1 = await ExpenseService.createExpense(trip.id, userA.id, {
      payerMemberId: memberA.id,
      amountPaise: 300000,
      description: 'Villa Stay',
      categoryId: foodCategory.id,
      splitMethod: 'EQUAL',
      allocations: [
        { memberId: memberA.id, sharePaise: 100000 },
        { memberId: dummyMemberRohan.id, sharePaise: 100000 },
        { memberId: dummyMemberPriya.id, sharePaise: 100000 },
      ],
    });

    expect(expense1.allocations.length).toBe(3);

    // Dummy member Rohan pays ₹1,500 (150000 paise) split equally between Rohan and User B (75000 paise each)
    // Submitter is User A on behalf of Rohan
    const expense2 = await ExpenseService.createExpense(trip.id, userA.id, {
      payerMemberId: dummyMemberRohan.id,
      amountPaise: 150000,
      description: 'Dinner at Shack',
      categoryId: foodCategory.id,
      splitMethod: 'EQUAL',
      allocations: [
        { memberId: dummyMemberRohan.id, sharePaise: 75000 },
        { memberId: memberB.id, sharePaise: 75000 },
      ],
    });

    expect(expense2.payerMemberId).toBe(dummyMemberRohan.id);

    // Verify settlement plan and individual net balances
    const plan = await SettlementService.getSettlementPlan(trip.id, userA.id);
    const balanceMap = new Map(plan.memberBalances.map((b) => [b.memberId, b.netBalancePaise]));

    // A: paid 300,000, share 100,000 -> net +200,000 paise (+₹2,000.00)
    expect(balanceMap.get(memberA.id)).toBe(200000);

    // Rohan (dummy): paid 150,000, share 100,000 + 75,000 = 175,000 -> net -25,000 paise (-₹250.00)
    expect(balanceMap.get(dummyMemberRohan.id)).toBe(-25000);

    // Priya (dummy): paid 0, share 100,000 -> net -100,000 paise (-₹1,000.00)
    expect(balanceMap.get(dummyMemberPriya.id)).toBe(-100000);

    // B: paid 0, share 75,000 -> net -75,000 paise (-₹750.00)
    expect(balanceMap.get(memberB.id)).toBe(-75000);

    // Exact zero-sum accounting invariant
    const sum = Array.from(balanceMap.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it('Step 4: Priya (dummy) records cash payment to A, updating balances', async () => {
    // Recorded by A as receiver
    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          tripId: trip.id,
          payerMemberId: dummyMemberPriya.id,
          receiverMemberId: memberA.id,
          amountPaise: 100000,
          paymentMethod: 'CASH',
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      await tx.ledgerEntry.create({
        data: {
          tripId: trip.id,
          eventType: 'PAYMENT_CONFIRMED',
          referenceId: p.id,
          memberId: dummyMemberPriya.id,
          creditPaise: 100000,
          debitPaise: 0,
          netChangePaise: 100000,
          balanceAfterPaise: 0,
          description: 'Cash payment from Priya to Alice',
        },
      });

      await tx.ledgerEntry.create({
        data: {
          tripId: trip.id,
          eventType: 'PAYMENT_CONFIRMED',
          referenceId: p.id,
          memberId: memberA.id,
          creditPaise: 0,
          debitPaise: 100000,
          netChangePaise: -100000,
          balanceAfterPaise: 0,
          description: 'Cash payment received from Priya',
        },
      });

      return p;
    });

    expect(payment.status).toBe('CONFIRMED');

    const plan = await SettlementService.getSettlementPlan(trip.id, userA.id);
    const balanceMap = new Map(plan.memberBalances.map((b) => [b.memberId, b.netBalancePaise]));

    // Priya is now fully settled (0 paise)
    expect(balanceMap.get(dummyMemberPriya.id)).toBe(0);

    // Alice is owed ₹1,000 (+100,000 paise)
    expect(balanceMap.get(memberA.id)).toBe(100000);
  });

  it('Step 5: Replace dummy member Rohan with registered user R transactionally', async () => {
    const replaced = await MembershipService.replaceDummyMember(
      trip.id,
      userA.id,
      dummyMemberRohan.id,
      { registeredUserId: userR.id }
    );

    expect(replaced.id).toBe(dummyMemberRohan.id); // Same memberId preserved!
    expect(replaced.userId).toBe(userR.id);
    expect(replaced.isDummy).toBe(false);

    // Check financial history preservation
    const expenses = await ExpenseService.listExpenses(trip.id);
    const rohanExpense = expenses.find((e) => e.payerMemberId === dummyMemberRohan.id);
    expect(rohanExpense).toBeDefined();
    expect(rohanExpense?.amountPaise).toBe(150000);

    // Verify balance after replacement is identical
    const plan = await SettlementService.getSettlementPlan(trip.id, userA.id);
    const rohanMemberBalance = plan.memberBalances.find((b) => b.memberId === dummyMemberRohan.id);
    expect(rohanMemberBalance).toBeDefined();
    expect(rohanMemberBalance?.userId).toBe(userR.id);
    expect(rohanMemberBalance?.userName).toBe('Rohan Sharma (Official)');
    expect(rohanMemberBalance?.netBalancePaise).toBe(-25000); // Exactly -₹250.00
  });

  it('Step 6: Rejects replacing a non-dummy or already registered member', async () => {
    // Attempting to replace dummyMemberRohan again should fail because it is now registered
    await expect(
      MembershipService.replaceDummyMember(trip.id, userA.id, dummyMemberRohan.id, {
        registeredUserId: userB.id,
      })
    ).rejects.toThrow('already linked to a registered account');

    // Attempting to replace with an existing trip member (User B) should fail
    await expect(
      MembershipService.replaceDummyMember(trip.id, userA.id, dummyMemberPriya.id, {
        registeredUserId: userB.id,
      })
    ).rejects.toThrow('User is already a member of this trip');
  });
});
