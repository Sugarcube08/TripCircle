# TripCircle — Verification & Testing Guide

## 1. Automated Test Suite

TripCircle includes automated unit tests for exact financial algorithms, zero-sum invariant assertions, and end-to-end integration tests for complete trip lifecycles.

### Running Tests

```bash
# Run all automated tests
pnpm test

# Run financial engine unit tests only
pnpm test:financial

# Run end-to-end integration tests only
pnpm test:integration

# Run workspace-wide typechecking
pnpm typecheck
```

---

## 2. Financial Unit Test Coverage (`tests/financial/calculator.test.ts`)

- **Equal Splitting:**
  - Perfectly divisible amounts.
  - Deterministic indivisible paise remainder distribution (e.g. ₹100 split 3 ways yields 3334, 3333, 3333 paise).
  - Validation of $\sum \text{shares} = \text{total}$.
- **Unequal Splitting:**
  - Exact match acceptance.
  - Sum mismatch rejection.
  - Negative allocation rejection.
- **Financial Invariants:**
  - Zero-sum conservation across trips: $\sum \text{net balances} = 0$.
  - Confirmed payments update balances and preserve zero-sum.
  - Disputed or pending payments do not affect balances.
  - Soft-deleted or superseded revisions do not duplicate financial effects.
  - Explicit settlement discounts waive debt cleanly without balance corruption.
- **Settlement Engine:**
  - Greedy debt simplification generates valid, deterministic transfers.
  - Fully settled trips produce zero transfers.
  - Person-to-person direct bilateral breakdown.

---

## 3. Integration Test Coverage (`tests/integration/api.test.ts`)

Simulates the complete 4-user acceptance scenario:
1. **User A** creates trip and invites **User B**, **User C**, and **User D**.
2. **User A** pays ₹1,200 split equally among A, B, and C (excluding D).
3. **User C** records a payment to A, which A initially disputes. Ledger balances verify zero effect from the dispute.
4. **User C** corrects payment details and submits a new payment, which A confirms. Balances update immediately.
5. **User B** settles remaining debt to A with an agreed ₹1 cash coin discount, which A accepts.
6. The settlement plan confirms `isSettled: true` and all member balances equal 0 paise.


## 4. CRUD and permission regression checks

Run with a trip creator, ordinary member, and (where applicable) a dummy member:

- Open expense and payment details from the ledger and activity feed. Confirm nullable member profiles do not crash rendering.
- Only an expense submitter or creator sees Edit/Delete; unauthorized API mutations return 403.
- Edit an expense and verify stale expectedVersion requests fail without duplicating ledger effects.
- Delete an expense and verify it disappears from lists, totals and ledger while an audit record remains.
- Pending payer/creator can edit or permanently delete a payment; receiver can confirm/dispute; payer can cancel. Confirmed payment cannot be edited or hard-deleted.
- Delete a trip as creator and verify it disappears for all participants and dependent records are removed. Non-creator receives 403.
- Verify total spent equals the sum of non-deleted expense amounts in integer paise; payments are excluded.
- Closed trips hide Add Expense and Record Payment while retaining settlement and export actions.

## 5. CI workflow

Pull requests and pushes to `main` run workspace typechecking, financial unit tests, and release-manifest validation. Android release builds run on version tags or manual dispatch and fail if the release APK cannot be built; a debug APK is not silently substituted.
