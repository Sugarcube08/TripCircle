import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { AuthService } from '../../src/modules/auth/service';
import { TripService } from '../../src/modules/trips/service';
import { ExpenseService } from '../../src/modules/expenses/service';
import { PaymentService } from '../../src/modules/payments/service';
import { SettlementService } from '../../src/modules/settlements/service';
import { SyncService } from '../../src/modules/sync/service';
import { UserService } from '../../src/modules/users/service';
import { StorageService } from '../../src/infrastructure/storage';

interface TimingStats {
  name: string;
  samples: number[];
  min: number;
  max: number;
  median: number;
  p95: number;
  avg: number;
}

function calculateStats(name: string, samples: number[]): TimingStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return { name, samples: sorted, min, max, median, p95, avg };
}

describe('TripCircle Performance Benchmarking Suite', () => {
  let userA: any;
  let userB: any;
  let trip1: any;
  let trip2: any;
  let foodCategory: any;
  let memberA1: any;
  let memberB1: any;

  const baselineResults: Record<string, TimingStats> = {};

  beforeAll(async () => {
    // Seed category
    foodCategory = await prisma.expenseCategory.upsert({
      where: { key: 'BENCH_FOOD' },
      update: {},
      create: { key: 'BENCH_FOOD', name: 'Food Bench', icon: 'restaurant' },
    });

    // Create users
    const resA = await AuthService.register({
      name: 'Benchmark User A',
      email: `bench.a.${Date.now()}@example.com`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/bench-a-qr.png',
    });
    userA = { id: resA.userId, email: resA.email };

    const resB = await AuthService.register({
      name: 'Benchmark User B',
      email: `bench.b.${Date.now()}@example.com`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/bench-b-qr.png',
    });
    userB = { id: resB.userId, email: resB.email };

    // Create trip 1 with members
    trip1 = await TripService.createTrip(userA.id, {
      name: 'Benchmark Trip 1',
      startDate: '2026-11-01',
      currency: 'INR',
    });

    memberA1 = trip1.members.find((m: any) => m.userId === userA.id);
    memberB1 = await prisma.tripMember.create({
      data: {
        tripId: trip1.id,
        userId: userB.id,
        role: 'MEMBER',
        status: 'ACTIVE',
      },
    });

    // Populate trip1 with 10 expenses and 5 payments to create realistic financial graph
    for (let i = 1; i <= 10; i++) {
      await ExpenseService.createExpense(trip1.id, userA.id, {
        payerMemberId: memberA1.id,
        amountPaise: 50000 + i * 1000,
        description: `Bench Expense ${i}`,
        categoryId: foodCategory.id,
        splitMethod: 'EQUAL',
        allocations: [
          { memberId: memberA1.id, sharePaise: 25000 + i * 500 },
          { memberId: memberB1.id, sharePaise: 25000 + i * 500 },
        ],
      });
    }

    for (let i = 1; i <= 5; i++) {
      const p = await PaymentService.createPayment(trip1.id, userB.id, {
        payerMemberId: memberB1.id,
        receiverMemberId: memberA1.id,
        amountPaise: 10000 + i * 500,
        paymentMethod: 'UPI',
        idempotencyKey: `bench-pay-${Date.now()}-${i}`,
      });
      await PaymentService.confirmPayment(trip1.id, p.id, userA.id);
    }
  });

  afterAll(async () => {
    // Cleanup
    if (trip1?.id) {
      await prisma.trip.delete({ where: { id: trip1.id } }).catch(() => {});
    }
    if (trip2?.id) {
      await prisma.trip.delete({ where: { id: trip2.id } }).catch(() => {});
    }
    if (userA?.id) {
      await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
    }
    if (userB?.id) {
      await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
    }

    console.log('\n=== TRIPCIRCLE PERFORMANCE MEASUREMENT RESULTS ===');
    for (const [key, stats] of Object.entries(baselineResults)) {
      console.log(
        `${key.padEnd(35)} | Med: ${stats.median.toFixed(2)}ms | p95: ${stats.p95.toFixed(2)}ms | Min: ${stats.min.toFixed(2)}ms | Max: ${stats.max.toFixed(2)}ms (N=${stats.samples.length})`
      );
    }
    console.log('===================================================\n');
  });

  it('measures TripService.getMyTrips latency', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      await TripService.getMyTrips(userA.id);
      const elapsed = performance.now() - start;
      samples.push(elapsed);
    }
    baselineResults['TripService.getMyTrips'] = calculateStats('TripService.getMyTrips', samples);
    expect(baselineResults['TripService.getMyTrips'].median).toBeGreaterThan(0);
  });

  it('measures TripService.getTripDetail latency', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      await TripService.getTripDetail(trip1.id, userA.id);
      const elapsed = performance.now() - start;
      samples.push(elapsed);
    }
    baselineResults['TripService.getTripDetail'] = calculateStats('TripService.getTripDetail', samples);
    expect(baselineResults['TripService.getTripDetail'].median).toBeGreaterThan(0);
  });

  it('measures SettlementService.getSettlementPlan latency', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      await SettlementService.getSettlementPlan(trip1.id, userA.id);
      const elapsed = performance.now() - start;
      samples.push(elapsed);
    }
    baselineResults['SettlementService.getSettlementPlan'] = calculateStats('SettlementService.getSettlementPlan', samples);
    expect(baselineResults['SettlementService.getSettlementPlan'].median).toBeGreaterThan(0);
  });

  it('measures SyncService.pullChanges latency (Cold & Incremental)', async () => {
    const coldSamples: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await SyncService.pullChanges(userA.id, undefined);
      coldSamples.push(performance.now() - start);
    }
    baselineResults['SyncService.pullChanges (Cold)'] = calculateStats('SyncService.pullChanges (Cold)', coldSamples);

    const warmSamples: number[] = [];
    const lastSync = new Date().toISOString();
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await SyncService.pullChanges(userA.id, lastSync);
      warmSamples.push(performance.now() - start);
    }
    baselineResults['SyncService.pullChanges (Warm)'] = calculateStats('SyncService.pullChanges (Warm)', warmSamples);

    expect(baselineResults['SyncService.pullChanges (Cold)'].median).toBeGreaterThan(0);
  });

  it('measures UserService.getProfile & UserService.updateProfile latency', async () => {
    const getSamples: number[] = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      await UserService.getProfile(userA.id);
      getSamples.push(performance.now() - start);
    }
    baselineResults['UserService.getProfile'] = calculateStats('UserService.getProfile', getSamples);

    const updateSamples: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await UserService.updateProfile(userA.id, {
        name: `Benchmark User A ${i}`,
        phone: `+91987654321${i % 10}`,
      });
      updateSamples.push(performance.now() - start);
    }
    baselineResults['UserService.updateProfile (Text)'] = calculateStats('UserService.updateProfile (Text)', updateSamples);

    expect(baselineResults['UserService.getProfile'].median).toBeGreaterThan(0);
  });

  it('measures Expense creation latency', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await ExpenseService.createExpense(trip1.id, userA.id, {
        payerMemberId: memberA1.id,
        amountPaise: 20000,
        description: `Bench Measure Exp ${i}`,
        categoryId: foodCategory.id,
        splitMethod: 'EQUAL',
        allocations: [
          { memberId: memberA1.id, sharePaise: 10000 },
          { memberId: memberB1.id, sharePaise: 10000 },
        ],
      });
      samples.push(performance.now() - start);
    }
    baselineResults['ExpenseService.createExpense'] = calculateStats('ExpenseService.createExpense', samples);
    expect(baselineResults['ExpenseService.createExpense'].median).toBeGreaterThan(0);
  });
});
