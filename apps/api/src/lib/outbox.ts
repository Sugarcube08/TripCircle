import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

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
 * Background worker processor for pending outbox events.
 * Can be invoked periodically or triggered after transactions.
 */
export async function processOutboxEvents(batchSize = 20) {
  const pendingEvents = await prisma.outboxEvent.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  for (const event of pendingEvents) {
    try {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSING', attempts: { increment: 1 } },
      });

      // Here notifications, push notifications or webhooks can be dispatched
      // Mark as completed
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });
    } catch (err) {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          error: (err as Error).message,
        },
      });
    }
  }

  return pendingEvents.length;
}
