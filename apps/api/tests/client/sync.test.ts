import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performSync, resetSyncThrottle } from '../../../mobile/src/services/sync';
import { LocalDatabase } from '../../../mobile/src/storage/db';
import * as apiModule from '../../../mobile/src/services/api';

describe('Synchronization Coordinator & LocalDatabase Tests', () => {
  beforeEach(async () => {
    resetSyncThrottle();
    await LocalDatabase.clear();
    await LocalDatabase.init('test-user-1');
    vi.restoreAllMocks();
  });

  it('1. First sync stores lastSyncTimestamp, trips, and details into LocalDatabase', async () => {
    const mockSyncResponse = {
      lastSyncTimestamp: '2026-10-29T20:00:00.000Z',
      trips: [{ id: 'trip-1', name: 'Manali Expedition', status: 'ACTIVE' }],
      notifications: [{ id: 'notif-1', title: 'Payment received' }],
      activeTripDetails: [
        {
          tripId: 'trip-1',
          expenses: [{ id: 'exp-1', amountPaise: 5000 }],
          payments: [{ id: 'pay-1', amountPaise: 2500 }],
          settlementPlan: { netBalances: [] },
        },
      ],
    };

    vi.spyOn(apiModule, 'apiRequest').mockResolvedValue(mockSyncResponse);

    const result = await performSync({ force: true });
    expect(result.success).toBe(true);
    expect(result.isOffline).toBe(false);
    expect(result.lastSyncTimestamp).toBe('2026-10-29T20:00:00.000Z');

    expect(LocalDatabase.getTrips()).toHaveLength(1);
    expect(LocalDatabase.getTrips()[0].name).toBe('Manali Expedition');
    expect(LocalDatabase.getExpenses('trip-1')).toHaveLength(1);
    expect(LocalDatabase.getPayments('trip-1')).toHaveLength(1);
  });

  it('2. Concurrent performSync calls reuse in-flight promise and execute only one network request', async () => {
    let apiCallCount = 0;
    vi.spyOn(apiModule, 'apiRequest').mockImplementation(async () => {
      apiCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        lastSyncTimestamp: '2026-10-29T20:05:00.000Z',
        trips: [{ id: 'trip-2', name: 'Goa Weekend' }],
        notifications: [],
        activeTripDetails: [],
      };
    });

    const [res1, res2, res3] = await Promise.all([
      performSync({ force: true }),
      performSync({ force: true }),
      performSync({ force: true }),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res3.success).toBe(true);
    expect(apiCallCount).toBe(1); // exactly one network request executed
  });

  it('3. Repeated non-forced syncs are throttled to save bandwidth and return cached state', async () => {
    let apiCallCount = 0;
    vi.spyOn(apiModule, 'apiRequest').mockImplementation(async () => {
      apiCallCount++;
      return {
        lastSyncTimestamp: '2026-10-29T20:10:00.000Z',
        trips: [{ id: 'trip-3', name: 'Kerala Backwaters' }],
        notifications: [],
        activeTripDetails: [],
      };
    });

    const res1 = await performSync({ force: true });
    expect(res1.skippedDueToThrottle).toBeFalsy();
    expect(apiCallCount).toBe(1);

    // Call sync immediately without force (e.g. rapid screen focus)
    const res2 = await performSync({ force: false });
    expect(res2.skippedDueToThrottle).toBe(true);
    expect(apiCallCount).toBe(1); // network request was NOT fired again
    expect(res2.trips).toHaveLength(1);
    expect(res2.trips?.[0].name).toBe('Kerala Backwaters');
  });

  it('4. Account isolation: Re-initializing cache with a different user resets cache state safely', async () => {
    LocalDatabase.saveTrips([{ id: 'trip-u1', name: 'User 1 Private Trip' }]);
    expect(LocalDatabase.getTrips()).toHaveLength(1);

    // Switch account to user 2
    await LocalDatabase.init('test-user-2');
    expect(LocalDatabase.getTrips()).toHaveLength(0);
  });
});
