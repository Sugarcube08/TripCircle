# tripCircle — Database Schema & Data Model

## 1. Relational Database: MySQL 8.0

Data persistence is managed via MySQL 8.0 using Prisma ORM with explicit migration scripts (`prisma/migrations/`). All monetary values are represented as signed 32-bit integer **paise** ($1\text{ Rupee} = 100\text{ paise}$).

---

## 2. Entity Relationship Overview

```text
User ────< Session
  │
  ├──────< OtpToken
  ├──────< Trip (Creator)
  ├──────< TripMember ─────< ExpenseAllocation
  │           │       ─────< LedgerEntry
  │           ├────────────< Expense (Payer)
  │           ├────────────< Payment (Payer / Receiver)
  │           └────────────< SettlementDiscount (From / To)
  ├──────< Expense (Submitter)
  ├──────< ExpenseRevision (Editor)
  ├──────< Notification
  ├──────< PushDeviceToken
  └──────< FileMetadata
```

---

## 3. Core Tables Reference

### `User`
- `id` (VARCHAR 191, PK): UUID
- `email` (VARCHAR 191, UNIQUE): Normalized lowercase email
- `passwordHash` (VARCHAR 191): Bcrypt salt/hash
- `name` (VARCHAR 191): Full display name
- `phone` (VARCHAR 191, NULL): Optional contact phone
- `avatarUrl`, `paymentQrUrl` (TEXT, NULL)
- `isEmailVerified` (BOOLEAN, default false)
- `createdAt`, `updatedAt` (DATETIME)

### `Trip`
- `id` (VARCHAR 191, PK)
- `name` (VARCHAR 100): Trip name
- `coverImageUrl`, `destination` (TEXT / VARCHAR)
- `startDate`, `endDate` (DATETIME)
- `currency` (VARCHAR 10, default 'INR')
- `status` (ENUM: `ACTIVE`, `CLOSED`)
- `creatorId` (FK -> `User.id`)
- `closedAt`, `reopenedAt` (DATETIME, NULL)

### `TripMember`
- `id` (VARCHAR 191, PK)
- `tripId` (FK -> `Trip.id`)
- `userId` (FK -> `User.id`)
- `role` (ENUM: `CREATOR`, `MEMBER`)
- `status` (ENUM: `INVITED`, `ACTIVE`, `DECLINED`, `LEFT`)
- `invitedAt`, `respondedAt`, `leftAt` (DATETIME)
- `UNIQUE(tripId, userId)`

### `Expense`
- `id` (VARCHAR 191, PK)
- `tripId` (FK -> `Trip.id`)
- `submitterId` (FK -> `User.id`)
- `payerMemberId` (FK -> `TripMember.id`)
- `amountPaise` (INT): Exact integer paise
- `categoryId` (FK -> `ExpenseCategory.id`)
- `description` (VARCHAR 200)
- `note`, `location`, `receiptUrl` (TEXT, NULL)
- `splitMethod` (ENUM: `EQUAL`, `UNEQUAL`)
- `version` (INT, default 1): Concurrency version
- `isDeleted` (BOOLEAN, default false)

### `ExpenseAllocation`
- `id` (VARCHAR 191, PK)
- `expenseId` (FK -> `Expense.id`)
- `memberId` (FK -> `TripMember.id`)
- `sharePaise` (INT): Share in paise ($\ge 0$)
- `UNIQUE(expenseId, memberId)`

### `ExpenseRevision`
- `id` (VARCHAR 191, PK)
- `expenseId` (FK -> `Expense.id`)
- `version` (INT): Concurrency version at edit time
- `editorId` (FK -> `User.id`)
- `amountPaise` (INT)
- `allocationsSnapshot` (JSON): Snapshot of shares
- `changeReason` (VARCHAR 255, NULL)

### `Payment`
- `id` (VARCHAR 191, PK)
- `tripId` (FK -> `Trip.id`)
- `payerMemberId`, `receiverMemberId` (FK -> `TripMember.id`)
- `amountPaise` (INT)
- `paymentMethod` (ENUM: `UPI`, `CASH`, `OTHER`)
- `status` (ENUM: `PENDING`, `CONFIRMED`, `DISPUTED`, `CANCELLED`)
- `disputeReason` (VARCHAR 500, NULL)
- `idempotencyKey` (VARCHAR 100, UNIQUE, NULL)
- `confirmedAt`, `disputedAt`, `cancelledAt` (DATETIME, NULL)

### `SettlementDiscount`
- `id` (VARCHAR 191, PK)
- `tripId` (FK -> `Trip.id`)
- `fromMemberId`, `toMemberId` (FK -> `TripMember.id`)
- `originalDebtPaise`, `paidAmountPaise`, `waivedPaise` (INT)
- `reason` (VARCHAR 255)
- `status` (ENUM: `PENDING`, `ACCEPTED`, `REJECTED`)

### `LedgerEntry`
- `id` (VARCHAR 191, PK)
- `tripId` (FK -> `Trip.id`)
- `eventType` (ENUM: `EXPENSE_CREATED`, `EXPENSE_EDITED`, `PAYMENT_CONFIRMED`, `SETTLEMENT_DISCOUNT`)
- `referenceId` (VARCHAR 100)
- `memberId` (FK -> `TripMember.id`)
- `creditPaise`, `debitPaise`, `netChangePaise` (INT)
- `description` (VARCHAR 255)

### `OutboxEvent`
- `id` (VARCHAR 191, PK)
- `aggregateType`, `aggregateId`, `eventType` (VARCHAR)
- `payload` (JSON)
- `status` (ENUM: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`)
- `attempts` (INT)

---

## 4. Migration & Seeding Commands

```bash
# Apply pending migrations
pnpm --filter @tripcircle/api db:migrate

# Seed demo trips and members
pnpm --filter @tripcircle/api db:seed
```
