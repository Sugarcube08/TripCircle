import { prisma } from '../../lib/prisma';
import { CreatePaymentInput, ConfirmPaymentInput, DisputePaymentInput } from '@tripcircle/contracts';
import { createOutboxEvent } from '../../lib/outbox';
import { SettlementService } from '../settlements/service';

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

      // 2. Verify payer belongs to trip
      const payer = await tx.tripMember.findUnique({
        where: { id: input.payerMemberId },
        include: { user: true },
      });

      if (!payer || payer.tripId !== tripId) {
        throw new Error('Invalid payer: member not found in this trip');
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

      // 4. Verify caller authorization:
      // Caller can record payment if:
      // - Caller is the payer (payer.userId === currentUserId)
      // - OR payer is an offline/dummy member and caller is the receiver acknowledging receipt
      // - OR caller is the trip creator
      const currentMember = await tx.tripMember.findFirst({
        where: { tripId, userId: currentUserId },
      });

      const isPayer = payer.userId === currentUserId;
      const isReceiver = receiver.userId === currentUserId;
      const isCreator = currentMember?.role === 'CREATOR';

      if (!isPayer && !(payer.isDummy && isReceiver) && !isCreator) {
        throw new Error('Forbidden: You can only record payments you made or received from offline members');
      }

      // 5. Determine whether payment should be auto-confirmed:
      // Dummy members do not have user accounts and cannot log in to approve payments.
      // - If receiver is dummy (receiver.isDummy || !receiver.userId), auto-confirm immediately.
      // - If payer is dummy and current user is receiver (or creator), auto-confirm immediately.
      const isAutoConfirm = Boolean(
        receiver.isDummy ||
        !receiver.userId ||
        (payer.isDummy && (isReceiver || isCreator))
      );

      const payerName = payer.user?.name || payer.displayName || 'Offline Member';
      const receiverName = receiver.user?.name || receiver.displayName || 'Offline Member';
      const now = new Date();

      const payment = await tx.payment.create({
        data: {
          tripId,
          payerMemberId: input.payerMemberId,
          receiverMemberId: input.receiverMemberId,
          amountPaise: input.amountPaise,
          paymentMethod: input.paymentMethod,
          status: isAutoConfirm ? 'CONFIRMED' : 'PENDING',
          confirmedAt: isAutoConfirm ? now : null,
          receiptUrl: input.receiptUrl,
          note: input.note,
          idempotencyKey: input.idempotencyKey,
        },
        include: {
          payerMember: { include: { user: true } },
          receiverMember: { include: { user: true } },
        },
      });

      if (isAutoConfirm) {
        // Immediate double-entry ledger update
        // Payer paid money -> balance increases towards 0 (+ credit)
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
            description: `Payment to ${receiverName}`,
          },
        });

        // Receiver received money -> balance decreases towards 0 (- debit)
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
            description: `Payment from ${payerName}`,
          },
        });

        if (receiver.userId && receiver.userId !== currentUserId) {
          await tx.notification.create({
            data: {
              userId: receiver.userId,
              tripId,
              type: 'PAYMENT_CONFIRMED',
              title: `Payment Received: ₹${(payment.amountPaise / 100).toFixed(2)}`,
              body: `${payerName} recorded a payment of ₹${(payment.amountPaise / 100).toFixed(2)} to you via ${payment.paymentMethod}. Ledger updated.`,
              data: { paymentId: payment.id, tripId },
            },
          });
        }

        await createOutboxEvent(tx, 'PAYMENT', payment.id, 'PAYMENT_CONFIRMED', {
          paymentId: payment.id,
          tripId,
          amountPaise: payment.amountPaise,
          autoConfirmed: true,
        });
      } else {
        // Standard pending confirmation flow for registered receiver
        if (receiver.userId) {
          await tx.notification.create({
            data: {
              userId: receiver.userId,
              tripId,
              type: 'PAYMENT_PENDING_CONFIRMATION',
              title: `Payment Received: ₹${(payment.amountPaise / 100).toFixed(2)}`,
              body: `${payerName} reported sending you ₹${(payment.amountPaise / 100).toFixed(2)} via ${payment.paymentMethod}. Please confirm or dispute.`,
              data: { paymentId: payment.id, tripId },
            },
          });
        }

        await createOutboxEvent(tx, 'PAYMENT', payment.id, 'PAYMENT_CREATED', {
          paymentId: payment.id,
          tripId,
          amountPaise: payment.amountPaise,
          receiverId: receiver.userId || 'OFFLINE',
        });
      }

      return payment;
    });
  }

  static async confirmPayment(
    tripId: string,
    paymentId: string,
    currentUserId: string,
    input?: ConfirmPaymentInput
  ) {
    const confirmedResult = await prisma.$transaction(async (tx) => {
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

      // Only the designated receiver (or trip creator if receiver is dummy) can confirm
      const isDesignatedReceiver = payment.receiverMember.userId === currentUserId;
      const currentMember = await tx.tripMember.findFirst({
        where: { tripId, userId: currentUserId },
      });
      const isCreator = currentMember?.role === 'CREATOR';

      if (!isDesignatedReceiver && !(payment.receiverMember.isDummy && isCreator)) {
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

      const payerName = payment.payerMember.user?.name || payment.payerMember.displayName || 'Offline Member';
      const receiverName = payment.receiverMember.user?.name || payment.receiverMember.displayName || 'Offline Member';

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
          description: `Confirmed payment to ${receiverName}`,
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
          description: `Confirmed payment from ${payerName}`,
        },
      });

      // Notify payer if registered
      if (payment.payerMember.userId) {
        await tx.notification.create({
          data: {
            userId: payment.payerMember.userId,
            tripId,
            type: 'PAYMENT_CONFIRMED',
            title: `Payment Confirmed: ₹${(payment.amountPaise / 100).toFixed(2)}`,
            body: `${receiverName} confirmed receiving your payment of ₹${(payment.amountPaise / 100).toFixed(2)}.`,
            data: { paymentId: payment.id, tripId },
          },
        });
      }

      await createOutboxEvent(tx, 'PAYMENT', payment.id, 'PAYMENT_CONFIRMED', {
        paymentId: payment.id,
        tripId,
        amountPaise: payment.amountPaise,
      });

      return confirmed;
    });

    // Auto-apply sub-rupee residual waivers (< ₹1.00) if payment resolved obligations
    await SettlementService.autoApplySubRupeeDiscounts(tripId).catch(() => []);

    return confirmedResult;
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

      // Only receiver (or trip creator if receiver is dummy) can dispute
      const isDesignatedReceiver = payment.receiverMember.userId === currentUserId;
      const currentMember = await tx.tripMember.findFirst({
        where: { tripId, userId: currentUserId },
      });
      const isCreator = currentMember?.role === 'CREATOR';

      if (!isDesignatedReceiver && !(payment.receiverMember.isDummy && isCreator)) {
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

      const receiverName = payment.receiverMember.user?.name || payment.receiverMember.displayName || 'Offline Member';

      // Notify payer if registered
      if (payment.payerMember.userId) {
        await tx.notification.create({
          data: {
            userId: payment.payerMember.userId,
            tripId,
            type: 'PAYMENT_DISPUTED',
            title: `Payment Disputed: ₹${(payment.amountPaise / 100).toFixed(2)}`,
            body: `${receiverName} disputed your payment: "${input.reason}". Balances have not been updated.`,
            data: { paymentId: payment.id, tripId },
          },
        });
      }

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

      // Only payer (or trip creator if payer is dummy) can cancel a pending payment
      const isPayer = payment.payerMember.userId === currentUserId;
      const currentMember = await tx.tripMember.findFirst({
        where: { tripId, userId: currentUserId },
      });
      const isCreator = currentMember?.role === 'CREATOR';

      if (!isPayer && !(payment.payerMember.isDummy && isCreator)) {
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
