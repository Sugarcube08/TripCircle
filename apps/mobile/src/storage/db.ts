export interface LocalCacheState {
  lastSyncTimestamp: string | null;
  trips: any[];
  tripDetails: Record<string, any>; // tripId -> detailed trip
  expenses: Record<string, any[]>;  // tripId -> expenses
  payments: Record<string, any[]>;  // tripId -> payments
  settlementPlans: Record<string, any>; // tripId -> plan
  notifications: any[];
}

let cache: LocalCacheState = {
  lastSyncTimestamp: null,
  trips: [],
  tripDetails: {},
  expenses: {},
  payments: {},
  settlementPlans: {},
  notifications: [],
};

export const LocalDatabase = {
  getCache(): LocalCacheState {
    return cache;
  },

  setLastSync(timestamp: string) {
    cache.lastSyncTimestamp = timestamp;
  },

  saveTrips(trips: any[]) {
    cache.trips = trips;
  },

  getTrips(): any[] {
    return cache.trips;
  },

  saveTripDetail(tripId: string, detail: any) {
    cache.tripDetails[tripId] = detail;
  },

  getTripDetail(tripId: string): any | null {
    return cache.tripDetails[tripId] || null;
  },

  saveExpenses(tripId: string, expenses: any[]) {
    cache.expenses[tripId] = expenses;
  },

  getExpenses(tripId: string): any[] {
    return cache.expenses[tripId] || [];
  },

  savePayments(tripId: string, payments: any[]) {
    cache.payments[tripId] = payments;
  },

  getPayments(tripId: string): any[] {
    return cache.payments[tripId] || [];
  },

  saveSettlementPlan(tripId: string, plan: any) {
    cache.settlementPlans[tripId] = plan;
  },

  getSettlementPlan(tripId: string): any | null {
    return cache.settlementPlans[tripId] || null;
  },

  saveNotifications(notifications: any[]) {
    cache.notifications = notifications;
  },

  getNotifications(): any[] {
    return cache.notifications;
  },

  clear() {
    cache = {
      lastSyncTimestamp: null,
      trips: [],
      tripDetails: {},
      expenses: {},
      payments: {},
      settlementPlans: {},
      notifications: [],
    };
  },
};
