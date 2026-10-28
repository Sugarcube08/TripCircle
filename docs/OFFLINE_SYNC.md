# tripCircle — Offline Access & Synchronization Architecture

## 1. Core Synchronization Principles

1. **Server-Authoritative:** The Next.js API server is the single source of truth for all balances, allocations, and transaction states.
2. **Offline-Safe Viewing:** All previously synchronized trips, expenses, member allocations, payments, and settlement recommendations are locally persisted and viewable offline.
3. **No Offline Financial Submissions:** Because tripCircle manages real financial liabilities without pre-approval queues, creating or modifying financial transactions requires network connectivity. This eliminates complex multi-master ledger divergence.
4. **Transparent Stale State:** When operating offline, the mobile interface presents an unmistakable offline banner displaying the exact `lastSyncTimestamp`.

---

## 2. Local Storage Architecture

The mobile app maintains local storage via `src/storage/db.ts`:
- **Trip Index:** Summary of all user trips with cached net positions.
- **Trip Details:** Member lists, roles, and status.
- **Expenses & Allocations:** Cached per trip.
- **Payments:** Confirmed, pending, and disputed records.
- **Settlement Plans:** Last calculated simplified transfers and balances.
- **Notifications:** In-app notification history.

---

## 3. Synchronization Flow

```text
Mobile App                           Next.js API Server
    │                                        │
    │  POST /api/v1/sync                     │
    │  { lastSyncTimestamp: "..." }          │
    ├───────────────────────────────────────>│
    │                                        │ Query records updated
    │                                        │ where updatedAt >= timestamp
    │                                        │
    │  { lastSyncTimestamp: "...",           │
    │    trips: [...],                       │
    │    activeTripDetails: [...],           │
    │    notifications: [...] }              │
    │<───────────────────────────────────────┤
    │                                        │
    ▼                                        ▼
Update Local SQLite Cache            Process Outbox Events
Set isOnline = true                  (Notifications, Push)
```

---

## 4. Conflict Handling

- **Expense Edits:** If User A and User B both view version 1 of an expense offline or concurrently, and User A submits an edit first (incrementing version to 2), User B's submission will include `expectedVersion: 1`. The server rejects User B's request with a `409 Conflict`, requiring User B to refresh and view User A's changes before submitting further edits.
- **Payment Lifecycle:** Payments cannot be confirmed or disputed more than once; the first response transitions the status from `PENDING`, and subsequent attempts are rejected with `400 Bad Request`.
