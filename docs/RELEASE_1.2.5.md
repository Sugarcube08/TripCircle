# TripCircle 1.2.5 Release Notes

**Release Line:** `1.2.5`  
**Android versionCode:** `3`  
**iOS buildNumber:** `3`  
**Date:** November 10, 2026  

---

## Highlights

### 1. Enhanced Edit Expense (Payee, Split Method & Allocations)
- **Full Payee Reassignment**: When modifying an expense, users can now change the payer member (`payerMemberId`). The backend atomically generates balancing ledger entries (`EXPENSE_EDITED`), reversing the previous payer posting and recording the new payer posting.
- **Dynamic Split Method & Custom Allocations**: Users can adjust the split method (`EQUAL` vs `UNEQUAL`) and revise individual member allocations (`allocations`).
- **Zero-Sum Ledger Invariant**: Reversals and replacements occur within a single database transaction, preserving total group balance $\sum \text{balance}_i = 0$ at all times.
- **Optimistic Concurrency Control**: Edits enforce `expectedVersion` checks against concurrent edits.
- **Audit Revision History**: An immutable `ExpenseRevision` record is saved for every edit, capturing the exact snapshot of payer, allocations, amount, and reason for change.
- **Polished Mobile UI**: `EditExpenseScreen` features:
  - Horizontal active member cards with avatars and selection indicators for selecting the payer.
  - Quick amount increment chips (`+100`, `+250`, `+500`, `+1000`).
  - Category selector strip with icons and theme colors.
  - Real-time unallocated remainder calculation banner for unequal splits.
  - Location, notes, and receipt attachment management (change, remove, or upload photo).

### 2. PDF Export UI/UX & Layout Architecture Overhaul
- **Ground-up Architecture**: Completely overhauled `generatePdfReport` in `apps/api/src/modules/reports/service.ts`.
- **Eliminated Coordinate Pollution**: Resolved overlapping text in trip metadata, notes, and report titles.
- **Zero Phantom Pages**: Eliminated bottom margin resets that previously produced ghost trailing blank pages.
- **Two-Pass Page Numbering**: Accurate `Page X of Y` footers rendered across all pages without layout disturbance.
- **Clean Sectional Structure**: Professional header badge, trip metadata cards, financial totals summary, member balances with credit/debt coloring, itemized expense breakdown table with beneficiary details, and settlement plan transfers.

### 3. API Auth Token Refresh Upgrade & Optimization
- **RFC 6819 Token Rotation Grace Cache**: Implemented a 30-second in-memory grace cache for rotated tokens. Concurrent requests from the same mobile client arriving within the grace window receive the cached token pair instead of triggering false-positive reuse revocation.
- **Cryptographic UUID Nonces**: Both access and refresh tokens now include unique `jwtid` UUID nonces to eliminate identical token signatures within the same second.
- **User Status Validation**: Token renewal verifies that the associated user exists and remains active.
- **Proactive Mobile Token Refresh**: Mobile client evaluates token expiry before executing API calls and proactively refreshes expiring tokens.
- **Network Fault Tolerance**: Offline or connection errors during refresh no longer wipe local auth sessions.

---

## Validation & Quality Assurance

- **Full Monorepo Typecheck**: Passed across contracts, API, and mobile packages.
- **Automated Vitest Test Suite**: 20 test suites, 140 tests passed, including dedicated test cases for:
  - Payee and split reallocation ledger reversals and invariants (`tests/expenses/edit-expense-payee-split.test.ts`).
  - Auth token rotation grace cache and concurrent refresh resilience (`tests/auth/refresh-grace.test.ts`).
  - PDF generation and visual layout structure (`tests/reports/export-and-notifications.test.ts`).
