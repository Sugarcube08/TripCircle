import { prisma } from '../../lib/prisma';
import { CreatePaymentInput, ConfirmPaymentInput, DisputePaymentInput } from '@tripcircle/contracts';
import { createOutboxEvent } from '../../lib/outbox';

export class PaymentService {
  static async createPayment(tripId: string, currentUserId: string, input: CreatePaymentInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Check idempotency
      if (input.idempotencyKey) {
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            payerMember: { include: { user: true } },
            receiverMember: { include: { user: true } },
          },
        });
        if (existing) {
          return existing;
        }
      }

      // 2. Verify payer belongs to current user
      const payer = await tx.tripMember.findUnique({
        where: { id: input.payerMemberId },
        include: { user: true },
      });

      if (!payer || payer.tripId !== tripId || payer.userId !== currentUserId) {
        throw new Error('Forbidden: You can only record payments you made');
      }

      // 3. Verify receiver belongs to trip
      const receiver = await tx.tripMember.findUnique({
        where: { id: input.receiverMemberId },
        include: { user: true },
      });

      if (!receiver || receiver.tripId !== tripId) {
        throw new Error('Invalid receiver: member not found in this trip');
      }

      if (payer.id === receiver.id) {
        throw new Error('Payer and receiver cannot be the same member');
      }

      // 4. Create pending payment
      const payment = await tx.payment.create({
        data: {
          tripId,
          payerMemberId: input.payerMemberId,
          receiverMemberId: input.receiverMemberId,
          amountPaise: input.amountPaise,
          paymentMethod: input.paymentMethod,
          status: 'PENDING',
          receiptUrl: input.receiptUrl,
          note: input.note,
          idempotencyKey: input.idempotencyKey,
        },
        include: {
          payerMember: { include: { user: true } },
          receiverMember: { include: { user: true } },
        },
      });

      // 5. Notify receiver
      await tx.notification.create({
        data: {
          userId: receiver.userId,
          tripId,
          type: 'PAYMENT_PENDING_CONFIRMATION',
          title: `Payment Received: ₹${(payment.amountPaise / 100).toFixed(2)}`,
          body: `${payer.user.name} reported sending you ₹${(payment.amountPaise / 100).toFixed(2)} via ${payment.paymentMethod}. Please confirm or dispute.`,
          data: { paymentId: payment.id, tripId },
        },
      });

      await createOutboxEvent(tx, 'PAYMENT', payment.id, 'PAYMENT_CREATED', {
        paymentId: payment.id,
        tripId,
        amountPaise: payment.amountPaise,
        receiverId: receiver.userId,
      });

      return payment;
    });
  }

  static async confirmPayment(
    tripId: string,
    paymentId: string,
    currentUserId: string,
    input?: ConfirmPaymentInput
  ) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          payerMember: { include: { user: true } },
          receiverMember: { include: { user: true } },
        },
      });

      if (!payment || payment.tripId !== tripId) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'PENDING') {
        throw new Error(`Cannot confirm payment: payment is already ${payment.status}`);
      }

      // Only the designated receiver can confirm
      if (payment.receiverMember.userId !== currentUserId) {
        throw new Error('Forbidden: Only the designated receiver can confirm this payment');
      }

      // Update payment status
      const confirmed = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          ...(input?.note ? { note: payment.note ? `${payment.note}\nConfirmation: ${input.note}` : input.note } : {}),
        },
        include: {
          payerMember: { include: { user: true } },
          receiverMember: { include: { user: true } },
        },
      });

      // Ledger entries for payment:
      // payer paid money -> payer's balance increases towards 0 (+ credit)
      // receiver received money -> receiver's balance decreases towards 0 (- debit)
      await tx.ledgerEntry.create({
        data: {
          tripId,
          eventType: 'PAYMENT_CONFIRMED',
          referenceId: payment.id,
          memberId: payment.payerMemberId,
          creditPaise: payment.amountPaise,
          debitPaise: 0,
          netChangePaise: payment.amountPaise,
          balanceAfterPaise: 0,
          description: `Confirmed payment to ${payment.receiverMember.user.name}`,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          tripId,
          eventType: 'PAYMENT_CONFIRMED',
          referenceId: payment.id,
          memberId: payment.receiverMemberId,
          creditPaise: 0,
          debitPaise: payment.amountPaise,
          netChangePaise: -payment.amountPaise,
          balanceAfterPaise: 0,
          description: `Confirmed payment from ${payment.payerMember.user.name}`,
        },
      });

      // Notify payer
      await tx.notification.create({
        data: {
          userId: payment.payerMember.userId,
          tripId,
          type: 'PAYMENT_CONFIRMED',
          title: `Payment Confirmed: ₹${(payment.amountPaise / 100).toFixed(2)}`,
          body: `${payment.receiverMember.user.name} confirmed receiving your payment of ₹${(payment.amountPaise / 100).toFixed(2)}.`,
          data: { paymentId: payment.id, tripId },
        },
      });

      await createOutboxEvent(tx, 'PAYMENT', payment.id, 'PAYMENT_CONFIRMED', {
        paymentId: payment.id,
        tripId,
        amountPaise: payment.amountPaise,
      });

      return confirmed;
    });
  }

  static async disputePayment(
    tripId: string,
    paymentId: string,
    currentUserId: string,
    input: DisputePaymentInput
  ) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          payerMember: { include: { user: true } },
          receiverMember: { include: { user: true } },
        },
      });

      if (!payment || payment.tripId !== tripId) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'PENDING') {
        throw new Error(`Cannot dispute payment: payment is already ${payment.status}`);
      }

      // Only receiver can dispute
      if (payment.receiverMember.userId !== currentUserId) {
        throw new Error('Forbidden: Only the designated receiver can dispute this payment');
      }

      const disputed = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'DISPUTED',
          disputeReason: input.reason,
          disputedAt: new Date(),
        },
        include: {
          payerMember: { include: { user: true } },
          receiverMember: { include: { user: true } },
        },
      });

      // Notify payer
      await tx.notification.create({
        data: {
          userId: payment.payerMember.userId,
          tripId,
          type: 'PAYMENT_DISPUTED',
          title: `Payment Disputed: ₹${(payment.amountPaise / 100).toFixed(2)}`,
          body: `${payment.receiverMember.user.name} disputed your payment: "${input.reason}". Balances have not been updated.`,
          data: { paymentId: payment.id, tripId },
        },
      });

      await createOutboxEvent(tx, 'PAYMENT', payment.id, 'PAYMENT_DISPUTED', {
        paymentId: payment.id,
        tripId,
        reason: input.reason,
      });

      return disputed;
    });
  }

  static async cancelPayment(tripId: string, paymentId: string, currentUserId: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          payerMember: { include: { user: true } },
          receiverMember: { include: { user: true } },
        },
      });

      if (!payment || payment.tripId !== tripId) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'PENDING') {
        throw new Error(`Cannot cancel payment: payment is already ${payment.status}`);
      }

      if (payment.payerMember.userId !== currentUserId) {
        throw new Error('Forbidden: Only the payer can cancel a pending payment');
      }

      const cancelled = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
        include: {
          payerMember: { include: { user: true } },
          receiverMember: { include: { user: true } },
        },
      });

      return cancelled;
    });
  }

  static async listPayments(tripId: string) {
    const payments = await prisma.payment.findMany({
      where: { tripId },
      include: {
        payerMember: { include: { user: true } },
        receiverMember: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments;
  }

  static async getPaymentDetail(tripId: string, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        payerMember: { include: { user: true } },
        receiverMember: { include: { user: true } },
      },
    });

    if (!payment || payment.tripId !== tripId) {
      throw new Error('Payment not found');
    }

    return payment;
  }
}
