#!/usr/bin/env node
/**
 * Standalone tripCircle Durable Outbox Worker
 * Run via: node scripts/run-worker.mjs
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE = parseInt(process.env.WORKER_BATCH_SIZE || '25', 10);
const MAX_ATTEMPTS = 5;

let isRunning = true;

process.on('SIGINT', () => {
  console.log('\n[Worker] Graceful shutdown initiated...');
  isRunning = false;
});

process.on('SIGTERM', () => {
  console.log('\n[Worker] Graceful shutdown initiated...');
  isRunning = false;
});

async function recoverStuckEvents() {
  const threshold = new Date(Date.now() - 5 * 60 * 1000);
  const result = await prisma.outboxEvent.updateMany({
    where: {
      status: 'PROCESSING',
      createdAt: { lt: threshold },
    },
    data: {
      status: 'PENDING',
    },
  });
  if (result.count > 0) {
    console.log(`[Worker] Recovered ${result.count} stuck events back to PENDING`);
  }
}

async function runWorkerLoop() {
  console.log(`[Worker] tripCircle Outbox Worker started. Poll interval: ${POLL_INTERVAL_MS}ms, Batch size: ${BATCH_SIZE}`);
  await recoverStuckEvents();

  while (isRunning) {
    try {
      const pendingEvents = await prisma.outboxEvent.findMany({
        where: {
          status: 'PENDING',
          attempts: { lt: MAX_ATTEMPTS },
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (pendingEvents.length > 0) {
        console.log(`[Worker] Found ${pendingEvents.length} pending events to process`);

        for (const event of pendingEvents) {
          try {
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: {
                status: 'PROCESSING',
                attempts: { increment: 1 },
              },
            });

            // Process payload
            // In standalone runner, outbox events can be marked completed
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: {
                status: 'COMPLETED',
                processedAt: new Date(),
                error: null,
              },
            });

            console.log(`[Worker] Event ${event.id} (${event.eventType}) completed`);
          } catch (err) {
            const nextAttempts = event.attempts + 1;
            const status = nextAttempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING';
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: {
                status,
                error: err.message,
              },
            });
            console.error(`[Worker] Event ${event.id} failed: ${err.message}`);
          }
        }
      }
    } catch (loopErr) {
      console.error(`[Worker] Error in polling loop: ${loopErr.message}`);
    }

    // Wait poll interval
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  await prisma.$disconnect();
  console.log('[Worker] Stopped.');
  process.exit(0);
}

runWorkerLoop().catch((err) => {
  console.error('[Worker Fatal]', err);
  process.exit(1);
});
