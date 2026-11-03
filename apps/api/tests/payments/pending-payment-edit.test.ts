import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { AuthService } from '../../src/modules/auth/service';
import { TripService } from '../../src/modules/trips/service';
import { PaymentService } from '../../src/modules/payments/service';

describe('Pending payment edit lifecycle', () => {
  let userA: any;
  let userB: any;
  let trip: any;
  let memberA: any;
  let memberB: any;
  let paymentId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    const a = await AuthService.register({
      name: 'Payment Editor A',
      email: `payment_editor_a_${suffix}@tripcircle.test`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/payment-a.png',
    });
    const b = await AuthService.register({
      name: 'Payment Editor B',
      email: `payment_editor_b_${suffix}@tripcircle.test`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/payment-b.png',
    });
    userA = { id: a.userId };
    userB = { id: b.userId };

    trip = await TripService.createTrip(userA.id, {
      name: 'Pending Payment Edit Test',
      currency: 'INR',
      startDate: new Date().toISOString(),
    });
    memberA = (await prisma.tripMember.findUniqueOrThrow({
      where: { tripId_userId: { tripId: trip.id, userId: userA.id } },
    }));
    memberB = await prisma.tripMember.create({
      data: { tripId: trip.id, userId: userB.id, role: 'MEMBER', status: 'ACTIVE' },
    });

    const payment = await PaymentService.createPayment(trip.id, userA.id, {
      payerMemberId: memberA.id,
      receiverMemberId: memberB.id,
      amountPaise: 12000,
      paymentMethod: 'UPI',
      note: 'Initial payment note',
    });
    paymentId = payment.id;
  });

  afterAll(async () => {
    if (trip?.id) {
      await prisma.trip.deleteMany({ where: { id: trip.id } });
    }
    if (userA?.id || userB?.id) {
      await prisma.user.deleteMany({ where: { id: { in: [userA?.id, userB?.id].filter(Boolean) as string[] } } });
    }
  });

  it('allows the payer to edit a pending payment and writes an audit record', async () => {
    const updated = await PaymentService.updatePendingPayment(trip.id, paymentId, userA.id, {
      amountPaise: 13500,
      paymentMethod: 'CASH',
      note: 'Corrected amount',
    });

    expect(updated.amountPaise).toBe(13500);
    expect(updated.paymentMethod).toBe('CASH');
    expect(updated.note).toBe('Corrected amount');

    const audit = await prisma.auditLog.findFirst({
      where: { tripId: trip.id, entityId: paymentId, action: 'EDIT_PENDING_PAYMENT' },
    });
    expect(audit).toBeDefined();
  });

  it('rejects edits after the payment becomes confirmed', async () => {
    await PaymentService.confirmPayment(trip.id, paymentId, userB.id);
    await expect(
      PaymentService.updatePendingPayment(trip.id, paymentId, userA.id, {
        amountPaise: 14000,
        paymentMethod: 'UPI',
      })
    ).rejects.toThrow('Only pending payments can be edited');
  });
});
