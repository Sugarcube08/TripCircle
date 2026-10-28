# TripCircle — Monorepo Architecture

## 1. System Overview

TripCircle is organized as a pnpm monorepo containing two independently deployable applications and a shared contract package:

```text
TripCircle/
├── apps/
│   ├── api/          # Next.js 14 Standalone REST API & Background Worker
│   └── mobile/       # React Native Expo Mobile Application
├── packages/
│   └── contracts/    # Shared TypeScript contracts, Zod schemas, constants & financial math
├── docs/             # Technical specifications and deployment guides
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

---

## 2. Component Boundaries

### `apps/api` (Next.js Standalone Backend)
- **Role:** Authoritative single source of truth for business logic, database transactions, financial ledger calculations, report exports, file access, and synchronization.
- **Runtime:** Node.js 20+ standalone output.
- **Database:** MySQL 8.0 accessed via Prisma ORM 5.22 with strict transactional boundaries.
- **Reporting:** Direct streaming of PDF (`pdfkit`) and Excel (`exceljs`) files.
- **Independent Deployment:** Builds to standalone Docker image (`apps/api/Dockerfile`) without any mobile dependency.

### `apps/mobile` (React Native Expo Application)
- **Role:** Mobile interface for iOS, Android, and Web providing rapid expense entry, member interaction, offline cached viewing, and settlement inspection.
- **Local Cache:** Structured local storage with SQLite and Expo SecureStore for auth tokens.
- **Sync Protocol:** Incremental pull synchronization via `/api/v1/sync` updating local state with conflict prevention.
- **Independent Deployment:** Independently built via Expo Application Services (EAS) or local React Native toolchains.

### `packages/contracts` (Shared Library)
- **Role:** Canonical type definitions, Zod runtime validation schemas, category constants, and shared financial algorithms (equal split remainder distribution, unequal split validation).
- **Consumption:** Bundled into both API and mobile applications at compile time.

---

## 3. Communication Architecture

```text
[ React Native Mobile Client ]
              │
   (HTTPS / REST JSON)
   [Bearer JWT Auth]
              ▼
    [ Next.js API Server ]
    ├── /api/v1/auth/*
    ├── /api/v1/trips/*
    ├── /api/v1/trips/:id/expenses/*
    ├── /api/v1/trips/:id/payments/*
    ├── /api/v1/trips/:id/settlement/*
    ├── /api/v1/trips/:id/reports/*
    └── /api/v1/sync
              │
    (Prisma Transactions)
              ▼
       [ MySQL 8.0 ]
       ├── User & Session
       ├── Trip & TripMember
       ├── Expense & Revision
       ├── Payment
       ├── SettlementDiscount
       ├── LedgerEntry
       └── OutboxEvent
```

---

## 4. Reliability & Transactional Outbox

When financial transactions are executed (creating an expense, editing an expense, confirming a payment, accepting a discount):
1. All database modifications occur atomically inside a `prisma.$transaction()`.
2. An `OutboxEvent` record is written inside the identical transaction.
3. If any step fails, the transaction aborts with zero side-effects.
4. Background workers process pending outbox events to ensure durable delivery of notifications and sync events.
