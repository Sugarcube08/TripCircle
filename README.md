# tripCircle (V1)

**Collaborative trip expense tracking, transparent financial records, and simplified group settlement.**

tripCircle is an end-to-end, production-oriented monorepo providing groups of friends with a shared financial ledger during trips. It features exact integer paise accounting, receiver-confirmed payments, immediate expense updates without approvals, auditable revision histories, greedy debt simplification settlement, offline viewing, and PDF/Excel export.

---

## Architecture

- **`apps/api`**: Next.js 14 Standalone REST API server, MySQL 8.0, Prisma ORM, Cloudflare R2 object storage, Gmail SMTP transactional email, durable transactional outbox worker, and PDF/Excel reports.
- **`apps/mobile`**: React Native Expo mobile application with clean finance-oriented UI, local SQLite caching, offline detection, and presigned R2 upload workflow.
- **`packages/contracts`**: Shared TypeScript types, Zod schemas, constants, and financial math.

---

## Production Infrastructure Stack

- **Object Storage:** Cloudflare R2 (S3-compatible API via `@aws-sdk/client-s3`) with private bucket policy and short-lived presigned URLs for upload (5m) and download (15m).
- **Transactional Email:** Gmail SMTP (`smtp.gmail.com:587` with STARTTLS) utilizing 16-character Google Account App Passwords and branded responsive templates.
- **Authoritative Database:** Remote MySQL 8.0 managed instance (AWS RDS, PlanetScale, DigitalOcean, Railway) with connection pooling and TLS enforcement.
- **Asynchronous Reliability:** Durable MySQL-backed transactional Outbox (`OutboxEvent`) with exponential backoff and recovery worker (`scripts/run-worker.mjs`).

---

## Core Product Guarantees

1. **Exact Accounting:** Money is stored and calculated in integer **paise** ($1\text{ Rupee} = 100\text{ paise}$).
2. **Zero-Sum Ledger Invariant:** $\sum \text{member net balances} = 0$ for every trip.
3. **No Approval Workflows for Expenses:** Submitted expenses immediately affect the ledger.
4. **Receiver-Confirmed Payments:** Payments affect balances only after the recipient confirms them. Disputed payments do not modify balances.
5. **Deterministic Debt Simplification:** Minimizes transfers between group members while reconciling 100% to net balances.
6. **Explicit Settlement Discounts:** Transparently records agreed waived coin/fractional balances with required creditor acceptance.
7. **Offline Access with Server Authority:** Cached records can be viewed offline; submissions require connectivity.
8. **Independent Deployment:** API and mobile applications can be built, configured, and released independently.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js $\ge 20$
- pnpm $\ge 10$
- Docker & Docker Compose

### 1. Start Infrastructure
```bash
# Start MySQL 8.0 container on port 3306
pnpm docker:up
```

### 2. Install Dependencies & Build Contracts
```bash
pnpm install
pnpm build:contracts
```

### 3. Run Migrations & Seed Database
```bash
# Push schema and apply migrations
pnpm db:migrate

# Seed demo users (Alice, Bob, Charlie, Dave) and Goa Trip
pnpm db:seed
```

Demo credentials:
- Users: `alice@tripcircle.app`, `bob@tripcircle.app`, `charlie@tripcircle.app`, `dave@tripcircle.app`
- Password: `Password@123`

### 4. Run Automated Tests
```bash
# Run all tests (financial invariants + integration)
pnpm test

# Run financial engine unit tests only
pnpm test:financial

# Run integration tests only
pnpm test:integration
```

### 5. Start Development Servers
```bash
# Start Next.js API server (http://localhost:3000)
pnpm dev:api

# Start React Native Expo mobile app
pnpm dev:mobile
```

---

## Workspace Scripts

| Command | Purpose |
|---|---|
| `pnpm dev:api` | Run Next.js API in development mode |
| `pnpm dev:mobile` | Run Expo mobile app |
| `pnpm build:api` | Build standalone production API server |
| `pnpm build:mobile`| Typecheck mobile application |
| `pnpm typecheck` | Run workspace-wide TypeScript validation |
| `pnpm test` | Run full test suite |
| `pnpm test:financial` | Run paise precision & invariant unit tests |
| `pnpm test:integration`| Run end-to-end trip lifecycle tests |
| `pnpm db:migrate` | Deploy Prisma database migrations to MySQL |
| `pnpm db:seed` | Seed realistic demo trips, expenses, and payments |
| `pnpm docker:up` | Start local Docker Compose services |
| `pnpm docker:down` | Stop local Docker Compose services |

---

## Documentation

Detailed specifications and architectural designs are available in the [`docs/`](./docs/) directory:

- [Product Specification](./docs/PRODUCT_SPEC.md)
- [System Architecture](./docs/ARCHITECTURE.md)
- [Database Schema & Data Model](./docs/DATABASE.md)
- [Financial Model & Exact Accounting](./docs/FINANCIAL_MODEL.md)
- [REST API Reference](./docs/API.md)
- [Security & Privacy Architecture](./docs/SECURITY.md)
- [Offline Access & Synchronization](./docs/OFFLINE_SYNC.md)
- [Independent Deployment Guide](./docs/DEPLOYMENT.md)
- [Testing & Verification Guide](./docs/TESTING.md)
