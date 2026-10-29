import { apiRequest, getOnlineStatus, setOnlineStatus } from './api';
import { LocalDatabase } from '../storage/db';

export async function performSync(options: { includeTripDetails?: boolean } = {}): Promise<{
  success: boolean;
  isOffline: boolean;
  lastSyncTimestamp: string | null;
  trips: any[];
}> {
  try {
    const cache = LocalDatabase.getCache();
    const result = await apiRequest('/sync', {
      method: 'POST',
      body: JSON.stringify({
        lastSyncTimestamp: cache.lastSyncTimestamp || undefined,
        ...(options.includeTripDetails === undefined ? {} : { includeTripDetails: options.includeTripDetails }),
      }),
    });

    setOnlineStatus(true);

    if (result.lastSyncTimestamp) {
      LocalDatabase.setLastSync(result.lastSyncTimestamp);
    }
    if (result.trips) {
      LocalDatabase.saveTrips(result.trips);
    }
    if (result.notifications) {
      LocalDatabase.saveNotifications(result.notifications);
    }
    if (result.activeTripDetails) {
      for (const item of result.activeTripDetails) {
        LocalDatabase.saveExpenses(item.tripId, item.expenses);
        LocalDatabase.savePayments(item.tripId, item.payments);
        LocalDatabase.saveSettlementPlan(item.tripId, item.settlementPlan);
      }
    }

    return {
      success: true,
      isOffline: false,
      lastSyncTimestamp: result.lastSyncTimestamp,
      trips: result.trips || LocalDatabase.getTrips(),
    };
  } catch (error) {
    console.warn('Sync failed (offline mode):', error);
    setOnlineStatus(false);
    return {
      success: false,
      isOffline: true,
      lastSyncTimestamp: LocalDatabase.getCache().lastSyncTimestamp,
      trips: LocalDatabase.getTrips(),
    };
  }
}
