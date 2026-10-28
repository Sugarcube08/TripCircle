import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { AuthService } from '../../src/modules/auth/service';
import { TripService } from '../../src/modules/trips/service';
import { ExpenseService } from '../../src/modules/expenses/service';
import { PaymentService } from '../../src/modules/payments/service';
import { SettlementService } from '../../src/modules/settlements/service';

describe('TripCircle End-to-End Financial & Lifecycle Integration Test', () => {
  let userA: any;
  let userB: any;
  let userC: any;
  let userD: any;

  let trip: any;
  let memberA: any;
  let memberB: any;
  let memberC: any;
  let memberD: any;

  let foodCat: any;

  beforeAll(async () => {
    // Clean up test data if existing
    await prisma.user.deleteMany({
      where: {
        email: { in: ['test.a@tripcircle.app', 'test.b@tripcircle.app', 'test.c@tripcircle.app', 'test.d@tripcircle.app'] },
      },
    });

    // 1. Register test users
    await AuthService.register({
      name: 'User A',
      email: 'test.a@tripcircle.app',
      password: 'Password@123',
      paymentQrUrl: 'https://storage.tripcircle.app/qrs/user_a.png',
    });
    userA = await prisma.user.update({
      where: { email: 'test.a@tripcircle.app' },
      data: { isEmailVerified: true },
    });

    await AuthService.register({
      name: 'User B',
      email: 'test.b@tripcircle.app',
      password: 'Password@123',
      paymentQrUrl: 'https://storage.tripcircle.app/qrs/user_b.png',
    });
    userB = await prisma.user.update({
      where: { email: 'test.b@tripcircle.app' },
      data: { isEmailVerified: true },
    });

    await AuthService.register({
      name: 'User C',
      email: 'test.c@tripcircle.app',
      password: 'Password@123',
      paymentQrUrl: 'https://storage.tripcircle.app/qrs/user_c.png',
    });
    userC = await prisma.user.update({
      where: { email: 'test.c@tripcircle.app' },
      data: { isEmailVerified: true },
    });

    await AuthService.register({
      name: 'User D',
      email: 'test.d@tripcircle.app',
      password: 'Password@123',
      paymentQrUrl: 'https://storage.tripcircle.app/qrs/user_d.png',
    });
    userD = await prisma.user.update({
      where: { email: 'test.d@tripcircle.app' },
      data: { isEmailVerified: true },
    });

    foodCat = await prisma.expenseCategory.findFirst({ where: { key: 'FOOD_DINING' } });
  });

  afterAll(async () => {
    if (trip?.id) {
      await prisma.trip.delete({ where: { id: trip.id } }).catch(() => { });
    }
    await prisma.user.deleteMany({
      where: {
        email: { in: ['test.a@tripcircle.app', 'test.b@tripcircle.app', 'test.c@tripcircle.app', 'test.d@tripcircle.app'] },
      },
    }).catch(() => { });
  });

  it('Step 1: User A creates a trip and invites B, C, D', async () => {
    trip = await TripService.createTrip(userA.id, {
      name: 'Manali Expedition',
      destination: 'Manali, Himachal Pradesh',
      startDate: new Date().toISOString(),
      currency: 'INR',
      initialInvitedUserIds: [userB.id, userC.id, userD.id],
    });

    expect(trip).toBeDefined();
    expect(trip.name).toBe('Manali Expedition');

    // Activate memberships for B, C, D
    await prisma.tripMember.updateMany({
      where: { tripId: trip.id, status: 'INVITED' },
      data: { status: 'ACTIVE', respondedAt: new Date() },
    });

    const members = await prisma.tripMember.findMany({ where: { tripId: trip.id } });
    memberA = members.find((m) => m.userId === userA.id);
    memberB = members.find((m) => m.userId === userB.id);
    memberC = members.find((m) => m.userId === userC.id);
    memberD = members.find((m) => m.userId === userD.id);

    expect(memberA).toBeDefined();
    expect(memberB).toBeDefined();
    expect(memberC).toBeDefined();
    expect(memberD).toBeDefined();
  });

  it('Step 2: A pays ₹1,200 split equally among A, B, and C (excluding D)', async () => {
    // 120000 paise split 3 ways = 40000 each
    const expense = await ExpenseService.createExpense(trip.id, userA.id, {
      payerMemberId: memberA.id,
      amountPaise: 120000,
      description: 'Mountain Cafe Lunch',
      categoryId: foodCat.id,
      splitMethod: 'EQUAL',
      allocations: [
        { memberId: memberA.id, sharePaise: 40000 },
        { memberId: memberB.id, sharePaise: 40000 },
        { memberId: memberC.id, sharePaise: 40000 },
      ],
    });

    expect(expense.amountPaise).toBe(120000);
    expect(expense.version).toBe(1);

    const settlement = await SettlementService.getSettlementPlan(trip.id, userA.id);
    const balA = settlement.memberBalances.find((m) => m.memberId === memberA.id);
    const balB = settlement.memberBalances.find((m) => m.memberId === memberB.id);
    const balD = settlement.memberBalances.find((m) => m.memberId === memberD.id);

    // A paid 1200, share 400 -> net +80000 (+₹800)
    expect(balA?.netBalancePaise).toBe(80000);
    // B share 400 -> net -40000 (-₹400)
    expect(balB?.netBalancePaise).toBe(-40000);
    // D not included -> net 0
    expect(balD?.netBalancePaise).toBe(0);
  });

  it('Step 3: C records payment to A, which A disputes', async () => {
    const payment = await PaymentService.createPayment(trip.id, userC.id, {
      payerMemberId: memberC.id,
      receiverMemberId: memberA.id,
      amountPaise: 40000,
      paymentMethod: 'UPI',
      note: 'Transfer for lunch',
    });

    expect(payment.status).toBe('PENDING');

    // A disputes the payment
    const disputed = await PaymentService.disputePayment(trip.id, payment.id, userA.id, {
      reason: 'UPI transaction not found in bank statement',
    });

    expect(disputed.status).toBe('DISPUTED');
    expect(disputed.disputeReason).toBe('UPI transaction not found in bank statement');

    // Balances must remain unchanged by disputed payment!
    const settlement = await SettlementService.getSettlementPlan(trip.id, userA.id);
    const balC = settlement.memberBalances.find((m) => m.memberId === memberC.id);
    expect(balC?.netBalancePaise).toBe(-40000); // C still owes 40000
  });

  it('Step 4: C records corrected payment to A, which A confirms', async () => {
    const payment2 = await PaymentService.createPayment(trip.id, userC.id, {
      payerMemberId: memberC.id,
      receiverMemberId: memberA.id,
      amountPaise: 40000,
      paymentMethod: 'UPI',
      note: 'Correct transfer with UTR #123456',
    });

    const confirmed = await PaymentService.confirmPayment(trip.id, payment2.id, userA.id);
    expect(confirmed.status).toBe('CONFIRMED');

    // Now C's balance should be 0 (paid their debt to A)
    const settlement = await SettlementService.getSettlementPlan(trip.id, userA.id);
    const balC = settlement.memberBalances.find((m) => m.memberId === memberC.id);
    expect(balC?.netBalancePaise).toBe(0);

    // A's net balance was +80000, received 40000 -> now +40000
    const balA = settlement.memberBalances.find((m) => m.memberId === memberA.id);
    expect(balA?.netBalancePaise).toBe(40000);
  });

  it('Step 5: B settles debt to A with explicit settlement discount', async () => {
    // B owes A ₹400 (40000 paise).
    // B pays ₹399 (39900 paise) and proposes waiving ₹1 (100 paise).
    const payment = await PaymentService.createPayment(trip.id, userB.id, {
      payerMemberId: memberB.id,
      receiverMemberId: memberA.id,
      amountPaise: 39900,
      paymentMethod: 'CASH',
    });
    await PaymentService.confirmPayment(trip.id, payment.id, userA.id);

    const discount = await SettlementService.proposeDiscount(trip.id, userB.id, {
      toMemberId: memberA.id,
      originalDebtPaise: 40000,
      paidAmountPaise: 39900,
      waivedPaise: 100,
      reason: 'Waived ₹1 coin remainder',
      paymentId: payment.id,
    });

    expect(discount.status).toBe('PENDING');

    // A accepts the discount
    const accepted = await SettlementService.respondDiscount(trip.id, discount.id, userA.id, {
      action: 'ACCEPT',
    });
    expect(accepted.status).toBe('ACCEPTED');

    // Now all balances should be completely settled!
    const finalSettlement = await SettlementService.getSettlementPlan(trip.id, userA.id);
    expect(finalSettlement.isSettled).toBe(true);

    for (const b of finalSettlement.memberBalances) {
      expect(b.netBalancePaise).toBe(0);
    }
  });
});
