import { apiRequest } from './api';
import { LocalDatabase } from '../storage/db';
import { dialog } from '../components/ui';

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  body?: string;
  description?: string;
  tripId?: string | null;
  data?: Record<string, any> | null;
  isRead?: boolean;
  createdAt?: string;
  timestamp?: string;
}

export interface ResolvedRoute {
  screen: string;
  params?: Record<string, any>;
}

// In-flight debounce guard to prevent duplicate rapid navigations
let lastHandledId: string | null = null;
let lastHandledTimestamp = 0;
const DEBOUNCE_WINDOW_MS = 1200;

// Reactive unread count listener subscription
type UnreadListener = (count: number) => void;
const unreadListeners = new Set<UnreadListener>();

export function getCachedUnreadCount(): number {
  const notifs = LocalDatabase.getNotifications();
  if (!Array.isArray(notifs)) return 0;
  return notifs.filter((n) => !n.isRead).length;
}

export function notifyUnreadCountChanged(): void {
  const count = getCachedUnreadCount();
  for (const listener of unreadListeners) {
    try {
      listener(count);
    } catch (err) {
      console.warn('[ActivityRouter] Unread listener error:', (err as Error).message);
    }
  }
}

export function subscribeToUnreadCount(listener: UnreadListener): () => void {
  unreadListeners.add(listener);
  // Immediately provide current count
  listener(getCachedUnreadCount());
  return () => {
    unreadListeners.delete(listener);
  };
}

export class ActivityRouter {
  /**
   * Resolves the target route and parameters from an activity record.
   */
  static resolveDestination(item: ActivityItem): ResolvedRoute | null {
    const type = (item.type || '').toUpperCase();
    const data = item.data || {};
    const tripId = item.tripId || data.tripId || null;

    // 1. Invitations
    if (type === 'TRIP_INVITATION') {
      return {
        screen: 'Invitations',
        params: {
          highlightTripId: tripId,
          invitationId: data.invitationId || data.memberId,
        },
      };
    }

    // 2. Expenses
    if (
      type === 'NEW_EXPENSE' ||
      type === 'EXPENSE_ADDED' ||
      type === 'EXPENSE_UPDATED' ||
      type === 'EXPENSE_DELETED'
    ) {
      const expenseId = data.expenseId;
      if (tripId && expenseId && type !== 'EXPENSE_DELETED') {
        return {
          screen: 'ExpenseDetail',
          params: { tripId, expenseId },
        };
      }
      if (tripId) {
        return {
          screen: 'TripDashboard',
          params: { tripId },
        };
      }
    }

    // 3. Payments (Pending confirmation, confirmed, disputed)
    if (
      type === 'PAYMENT_PENDING_CONFIRMATION' ||
      type === 'PAYMENT_CONFIRMED' ||
      type === 'PAYMENT_DISPUTED' ||
      type === 'PAYMENT_RECORDED' ||
      type === 'PAYMENT_CANCELLED'
    ) {
      const paymentId = data.paymentId;
      if (tripId && paymentId) {
        return {
          screen: 'PaymentDetail',
          params: { tripId, paymentId },
        };
      }
      if (tripId) {
        return {
          screen: 'TripDashboard',
          params: { tripId },
        };
      }
    }

    // 4. Settlement & Discounts
    if (
      type === 'DISCOUNT_PROPOSED' ||
      type === 'DISCOUNT_RESPONSE' ||
      type === 'DISCOUNT_AUTO_WAIVED' ||
      type === 'SETTLEMENT_COMPLETED' ||
      type === 'SETTLEMENT_PLAN_UPDATED'
    ) {
      if (tripId) {
        return {
          screen: 'SettlementDashboard',
          params: { tripId },
        };
      }
    }

    // 5. Membership Events
    if (
      type === 'DUMMY_MEMBER_REPLACED' ||
      type === 'MEMBER_JOINED' ||
      type === 'MEMBER_LEFT' ||
      type === 'INVITATION_RESPONSE' ||
      type === 'ROLE_CHANGED'
    ) {
      if (tripId) {
        return {
          screen: 'TripMembers',
          params: { tripId },
        };
      }
    }

    // 6. Generic Trip Events (Closure, Reopening, etc.)
    if (tripId) {
      return {
        screen: 'TripDashboard',
        params: { tripId },
      };
    }

    // Unsupported or targetless activity
    return null;
  }

  /**
   * Dispatches navigation to the exact destination, marks the record as read,
   * updates unread badges, and prevents double-tap collisions.
   */
  static async routeActivity(item: ActivityItem, navigation: any): Promise<boolean> {
    const now = Date.now();
    if (lastHandledId === item.id && now - lastHandledTimestamp < DEBOUNCE_WINDOW_MS) {
      return false;
    }
    lastHandledId = item.id;
    lastHandledTimestamp = now;

    // Optimistically mark as read in local storage and notify listeners
    this.markAsReadLocally(item.id);

    // Fire non-blocking API mark-as-read call
    apiRequest('/notifications', {
      method: 'POST',
      body: JSON.stringify({ notificationId: item.id }),
    }).catch((err) => {
      console.warn('[ActivityRouter] markAsRead API warning:', (err as Error).message);
    });

    const destination = this.resolveDestination(item);

    if (destination && navigation && typeof navigation.navigate === 'function') {
      try {
        navigation.navigate(destination.screen, destination.params);
        return true;
      } catch (navErr) {
        console.warn('[ActivityRouter] Navigation error:', (navErr as Error).message);
      }
    }

    // Fallback for targetless or unsupported records
    const title = item.title || 'Notification';
    const body = item.body || item.description || 'No additional details available.';
    await dialog.alert(title, body, 'info');
    return false;
  }

  /**
   * Updates local read state and notifies reactive badge listeners.
   */
  static markAsReadLocally(notificationId?: string): void {
    const notifs = LocalDatabase.getNotifications();
    if (!Array.isArray(notifs)) return;

    if (notificationId) {
      let changed = false;
      for (const n of notifs) {
        if (n.id === notificationId && !n.isRead) {
          n.isRead = true;
          changed = true;
        }
      }
      if (changed) {
        LocalDatabase.saveNotifications([...notifs]);
        notifyUnreadCountChanged();
      }
    } else {
      // Mark all read
      let changed = false;
      for (const n of notifs) {
        if (!n.isRead) {
          n.isRead = true;
          changed = true;
        }
      }
      if (changed) {
        LocalDatabase.saveNotifications([...notifs]);
        notifyUnreadCountChanged();
      }
    }
  }

  /**
   * Synchronizes unread count from the API server.
   */
  static async refreshUnreadCount(): Promise<number> {
    try {
      const res = await apiRequest('/notifications?countOnly=true');
      if (res && typeof res.unreadCount === 'number') {
        return res.unreadCount;
      }
    } catch {
      // Fallback to local cache count
    }
    return getCachedUnreadCount();
  }
}
