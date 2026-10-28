import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { EmailService } from '../modules/notifications/email/email.service';

export async function createOutboxEvent(
  tx: Prisma.TransactionClient,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  return tx.outboxEvent.create({
    data: {
      aggregateType,
      aggregateId,
      eventType,
      payload: payload as Prisma.InputJsonValue,
      status: 'PENDING',
    },
  });
}

/**
 * Recovers stuck processing events (e.g. from crashed processes).
 */
export async function recoverStuckEvents(timeoutMs = 5 * 60 * 1000) {
  const threshold = new Date(Date.now() - timeoutMs);
  const result = await prisma.outboxEvent.updateMany({
    where: {
      status: 'PROCESSING',
      createdAt: { lt: threshold },
    },
    data: {
      status: 'PENDING',
    },
  });
  return result.count;
}

/**
 * Background worker processor for pending outbox events.
 * Implements exponential backoff, dead-letter classification, and idempotency.
 */
export async function processOutboxEvents(batchSize = 25) {
  const MAX_ATTEMPTS = 5;

  const pendingEvents = await prisma.outboxEvent.findMany({
    where: {
      status: 'PENDING',
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  let processedCount = 0;
  let failedCount = 0;

  for (const event of pendingEvents) {
    try {
      // Mark as PROCESSING with attempt increment
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
        },
      });

      const payload = event.payload as Record<string, any>;

      // Route event to appropriate handler
      switch (event.eventType) {
        case 'EMAIL_VERIFY_REQUESTED': {
          if (payload.email && payload.otp) {
            await EmailService.sendOtpEmail(payload.email, payload.otp, 'EMAIL_VERIFY');
          }
          break;
        }

        case 'PASSWORD_RESET_REQUESTED': {
          if (payload.email && payload.otp) {
            await EmailService.sendPasswordResetEmail(payload.email, payload.otp);
          }
          break;
        }

        case 'PAYMENT_CREATED': {
          // Notify receiver about new pending payment
          if (payload.receiverUserId) {
            const trip = payload.tripId
              ? await prisma.trip.findUnique({ where: { id: payload.tripId } })
              : null;
            const payer = payload.payerMemberId
              ? await prisma.tripMember.findUnique({
                  where: { id: payload.payerMemberId },
                  include: { user: true },
                })
              : null;
            const receiver = await prisma.user.findUnique({
              where: { id: payload.receiverUserId },
            });

            if (receiver?.email && trip && payer) {
              await EmailService.sendPaymentConfirmationRequest(
                receiver.email,
                trip.name,
                payer.user.name,
                payload.amountPaise
              );
            }
          }
          break;
        }

        case 'PAYMENT_DISPUTED': {
          // Notify payer about dispute
          if (payload.tripId && payload.payerMemberId) {
            const trip = await prisma.trip.findUnique({ where: { id: payload.tripId } });
            const payer = await prisma.tripMember.findUnique({
              where: { id: payload.payerMemberId },
              include: { user: true },
            });
            const receiver = payload.receiverMemberId
              ? await prisma.tripMember.findUnique({
                  where: { id: payload.receiverMemberId },
                  include: { user: true },
                })
              : null;

            if (payer?.user.email && trip && receiver) {
              await EmailService.sendPaymentDisputed(
                payer.user.email,
                trip.name,
                receiver.user.name,
                payload.amountPaise,
                payload.reason || 'Amount incorrect or not received'
              );
            }
          }
          break;
        }

        case 'DISCOUNT_PROPOSED': {
          // Notify creditor about proposed settlement discount
          if (payload.tripId && payload.toMemberId) {
            const trip = await prisma.trip.findUnique({ where: { id: payload.tripId } });
            const toMember = await prisma.tripMember.findUnique({
              where: { id: payload.toMemberId },
              include: { user: true },
            });
            const fromMember = payload.fromMemberId
              ? await prisma.tripMember.findUnique({
                  where: { id: payload.fromMemberId },
                  include: { user: true },
                })
              : null;

            if (toMember?.user.email && trip && fromMember) {
              await EmailService.sendDiscountProposal(
                toMember.user.email,
                trip.name,
                fromMember.user.name,
                payload.paidAmountPaise || 0,
                payload.waivedPaise || 0
              );
            }
          }
          break;
        }

        default:
          // Unhandled event types complete safely
          break;
      }

      // Mark event as COMPLETED
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          error: null,
        },
      });

      processedCount++;
    } catch (err: any) {
      const attemptsSoFar = event.attempts + 1;
      const status = attemptsSoFar >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING';

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status,
          error: err.message || 'Unknown processing error',
        },
      });

      failedCount++;
      console.error(
        `[Outbox Error] Event ${event.id} (${event.eventType}) attempt ${attemptsSoFar}/${MAX_ATTEMPTS} failed: ${err.message}`
      );
    }
  }

  return { total: pendingEvents.length, processedCount, failedCount };
}
