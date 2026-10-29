import * as FileSystem from 'expo-file-system';

export interface AggregateNetPosition {
  netOwedToUserPaise: number;
  netUserOwesPaise: number;
  overallNetBalancePaise: number;
  activeTripsCount: number;
}

export interface LocalCacheState {
  version: number;
  lastSyncTimestamp: string | null;
  currentUserId?: string | null;
  aggregateNetPosition?: AggregateNetPosition | null;
  trips: any[];
  tripDetails: Record<string, any>; // tripId -> detailed trip
  expenses: Record<string, any[]>; // tripId -> expenses
  payments: Record<string, any[]>; // tripId -> payments
  settlementPlans: Record<string, any>; // tripId -> plan
  notifications: any[];
}

const CURRENT_CACHE_VERSION = 1;

const DEFAULT_STATE: LocalCacheState = {
  version: CURRENT_CACHE_VERSION,
  lastSyncTimestamp: null,
  currentUserId: null,
  aggregateNetPosition: null,
  trips: [],
  tripDetails: {},
  expenses: {},
  payments: {},
  settlementPlans: {},
  notifications: [],
};

let cache: LocalCacheState = { ...DEFAULT_STATE };
let isInitialized = false;
let persistTimer: any = null;

function getCacheFilePath(userId?: string | null): string | null {
  if (FileSystem.documentDirectory) {
    const userSuffix = userId ? `_u_${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '_anon';
    return `${FileSystem.documentDirectory}tripcircle_cache_v${CURRENT_CACHE_VERSION}${userSuffix}.json`;
  }
  return null;
}

/**
 * Persists the in-memory cache to disk asynchronously.
 * Debounced to coalesce rapid updates into a single atomic disk write.
 */
function schedulePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(async () => {
    persistTimer = null;
    const path = getCacheFilePath(cache.currentUserId);
    if (!path) return;

    try {
      const serialized = JSON.stringify(cache);
      await FileSystem.writeAsStringAsync(path, serialized, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (err) {
      // In-memory cache continues operating safely even if disk write fails
      console.warn('[LocalDatabase] Disk write warning:', (err as Error).message);
    }
  }, 100);
}

export const LocalDatabase = {
  /**
   * Initializes the persistent cache on app startup or user authentication.
   * Loads cached trips, details, and balances for the specific user into memory.
   */
  async init(userId?: string | null): Promise<void> {
    const targetUserId = userId || null;

    if (isInitialized && cache.currentUserId === targetUserId) {
      return;
    }

    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }

    // Always reset in-memory cache when user changes to prevent cross-account leakage
    cache = { ...DEFAULT_STATE, currentUserId: targetUserId };

    // Clean up legacy single-user cache file if present
    if (FileSystem.documentDirectory) {
      const legacyPath = `${FileSystem.documentDirectory}tripcircle_cache_v${CURRENT_CACHE_VERSION}.json`;
      FileSystem.deleteAsync(legacyPath, { idempotent: true }).catch(() => {});
    }

    const path = getCacheFilePath(targetUserId);
    if (!path) {
      isInitialized = true;
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(path, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const parsed = JSON.parse(raw);

        // Account isolation: Verify user identity matches cache payload
        if (parsed && parsed.version === CURRENT_CACHE_VERSION && parsed.currentUserId === targetUserId) {
          cache = {
            ...DEFAULT_STATE,
            ...parsed,
            currentUserId: targetUserId,
          };
        }
      }
    } catch (err) {
      console.warn('[LocalDatabase] Cache recovery notice:', (err as Error).message);
      cache = { ...DEFAULT_STATE, currentUserId: targetUserId };
    } finally {
      isInitialized = true;
    }
  },

  /**
   * Purges in-memory cache immediately (used during logout / account switch).
   */
  resetMemory(): void {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    cache = { ...DEFAULT_STATE };
    isInitialized = false;
  },

  getCache(): LocalCacheState {
    return cache;
  },

  setLastSync(timestamp: string) {
    cache.lastSyncTimestamp = timestamp;
    schedulePersist();
  },

  saveTrips(trips: any[]) {
    cache.trips = trips;
    // Keep aggregate net position reconciled with trips
    const activeTrips = trips.filter((t: any) => t.status !== 'CLOSED');
    let owed = 0;
    let owes = 0;
    for (const t of activeTrips) {
      const bal = t.userNetBalancePaise || 0;
      if (bal > 0) owed += bal;
      else if (bal < 0) owes += Math.abs(bal);
    }
    cache.aggregateNetPosition = {
      netOwedToUserPaise: owed,
      netUserOwesPaise: owes,
      overallNetBalancePaise: owed - owes,
      activeTripsCount: activeTrips.length,
    };
    schedulePersist();
  },

  saveAggregateNetPosition(pos: AggregateNetPosition) {
    cache.aggregateNetPosition = pos;
    schedulePersist();
  },

  getAggregateNetPosition(): AggregateNetPosition | null {
    if (cache.aggregateNetPosition) return cache.aggregateNetPosition;
    if (cache.trips && cache.trips.length > 0) {
      const activeTrips = cache.trips.filter((t: any) => t.status !== 'CLOSED');
      let owed = 0;
      let owes = 0;
      for (const t of activeTrips) {
        const bal = t.userNetBalancePaise || 0;
        if (bal > 0) owed += bal;
        else if (bal < 0) owes += Math.abs(bal);
      }
      return {
        netOwedToUserPaise: owed,
        netUserOwesPaise: owes,
        overallNetBalancePaise: owed - owes,
        activeTripsCount: activeTrips.length,
      };
    }
    return null;
  },

  updateTripNetBalance(tripId: string, balancePaise: number) {
    let modified = false;
    cache.trips = cache.trips.map((t: any) => {
      if (t.id === tripId) {
        modified = true;
        return { ...t, userNetBalancePaise: balancePaise };
      }
      return t;
    });

    if (cache.tripDetails[tripId]) {
      cache.tripDetails[tripId].userNetBalancePaise = balancePaise;
    }

    // Reconcile aggregate
    const activeTrips = cache.trips.filter((t: any) => t.status !== 'CLOSED');
    let owed = 0;
    let owes = 0;
    for (const t of activeTrips) {
      const bal = t.userNetBalancePaise || 0;
      if (bal > 0) owed += bal;
      else if (bal < 0) owes += Math.abs(bal);
    }
    cache.aggregateNetPosition = {
      netOwedToUserPaise: owed,
      netUserOwesPaise: owes,
      overallNetBalancePaise: owed - owes,
      activeTripsCount: activeTrips.length,
    };

    schedulePersist();
  },

  getTrips(): any[] {
    return cache.trips;
  },

  saveTripDetail(tripId: string, detail: any) {
    cache.tripDetails[tripId] = detail;
    if (detail && typeof detail.userNetBalancePaise === 'number') {
      const existing = cache.trips.find((t: any) => t.id === tripId);
      if (existing && existing.userNetBalancePaise !== detail.userNetBalancePaise) {
        this.updateTripNetBalance(tripId, detail.userNetBalancePaise);
        return;
      }
    }
    schedulePersist();
  },

  getTripDetail(tripId: string): any | null {
    return cache.tripDetails[tripId] || null;
  },

  saveExpenses(tripId: string, expenses: any[]) {
    cache.expenses[tripId] = expenses;
    schedulePersist();
  },

  getExpenses(tripId: string): any[] {
    return cache.expenses[tripId] || [];
  },

  savePayments(tripId: string, payments: any[]) {
    cache.payments[tripId] = payments;
    schedulePersist();
  },

  getPayments(tripId: string): any[] {
    return cache.payments[tripId] || [];
  },

  saveSettlementPlan(tripId: string, plan: any) {
    cache.settlementPlans[tripId] = plan;
    schedulePersist();
  },

  getSettlementPlan(tripId: string): any | null {
    return cache.settlementPlans[tripId] || null;
  },

  saveNotifications(notifications: any[]) {
    cache.notifications = notifications;
    schedulePersist();
  },

  getNotifications(): any[] {
    return cache.notifications;
  },

  async clear(): Promise<void> {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }

    const currentUid = cache.currentUserId;
    cache = { ...DEFAULT_STATE };
    isInitialized = false;

    const path = getCacheFilePath(currentUid);
    if (path) {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          await FileSystem.deleteAsync(path, { idempotent: true });
        }
      } catch (err) {
        console.warn('[LocalDatabase] Cache delete warning:', (err as Error).message);
      }
    }
  },
};
