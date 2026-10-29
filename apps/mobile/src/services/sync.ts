import { apiRequest, setOnlineStatus } from './api';
import { LocalDatabase } from '../storage/db';

export interface SyncOptions {
  force?: boolean;
  requestedTripIds?: string[];
  signal?: AbortSignal;
}

export interface SyncResult {
  success: boolean;
  isOffline: boolean;
  lastSyncTimestamp: string | null;
  trips?: any[];
  skippedDueToThrottle?: boolean;
}

// Global synchronization coordinator state
let activeSyncPromise: Promise<SyncResult> | null = null;
let lastSyncSuccessTimestamp = 0;
const SYNC_THROTTLE_MS = 15000; // 15 seconds focus throttle

/**
 * Coordinated incremental synchronization.
 * Deduplicates in-flight calls, throttles rapid repetitive focus requests,
 * and maintains atomic persistence in LocalDatabase.
 */
export async function performSync(options: SyncOptions = {}): Promise<SyncResult> {
  const now = Date.now();

  // If sync succeeded recently and caller did not explicitly force a refresh (e.g. pull-to-refresh),
  // return immediately with cached state to preserve battery and network.
  if (!options.force && now - lastSyncSuccessTimestamp < SYNC_THROTTLE_MS) {
    const cache = LocalDatabase.getCache();
    return {
      success: true,
      isOffline: false,
      lastSyncTimestamp: cache.lastSyncTimestamp,
      trips: cache.trips,
      skippedDueToThrottle: true,
    };
  }

  // If a synchronization job is already actively in-flight, reuse it rather than starting a competing request
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async (): Promise<SyncResult> => {
    try {
      const cache = LocalDatabase.getCache();
      const result = await apiRequest('/sync', {
        method: 'POST',
        body: JSON.stringify({
          lastSyncTimestamp: cache.lastSyncTimestamp || undefined,
          requestedTripIds: options.requestedTripIds,
        }),
        signal: options.signal,
        timeoutMs: 20000,
      });

      setOnlineStatus(true);
      lastSyncSuccessTimestamp = Date.now();

      if (result.lastSyncTimestamp) {
        LocalDatabase.setLastSync(result.lastSyncTimestamp);
      }
      if (result.trips && Array.isArray(result.trips)) {
        LocalDatabase.saveTrips(result.trips);
      }
      if (result.notifications && Array.isArray(result.notifications)) {
        LocalDatabase.saveNotifications(result.notifications);
      }
      if (result.activeTripDetails && Array.isArray(result.activeTripDetails)) {
        for (const item of result.activeTripDetails) {
          if (item.tripId) {
            if (item.expenses) LocalDatabase.saveExpenses(item.tripId, item.expenses);
            if (item.payments) LocalDatabase.savePayments(item.tripId, item.payments);
            if (item.settlementPlan) LocalDatabase.saveSettlementPlan(item.tripId, item.settlementPlan);
          }
        }
      }

      return {
        success: true,
        isOffline: false,
        lastSyncTimestamp: result.lastSyncTimestamp,
        trips: result.trips || cache.trips,
      };
    } catch (error: any) {
      const isAborted = error?.name === 'AbortError' || error?.code === 'ABORTED';
      if (!isAborted) {
        setOnlineStatus(false);
      }

      const cache = LocalDatabase.getCache();
      return {
        success: false,
        isOffline: true,
        lastSyncTimestamp: cache.lastSyncTimestamp,
        trips: cache.trips,
      };
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

/**
 * Resets sync throttle state (e.g. on user login or manual reset)
 */
export function resetSyncThrottle() {
  lastSyncSuccessTimestamp = 0;
}
