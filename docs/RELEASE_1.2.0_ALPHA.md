# TripCircle 1.2.0 Alpha Release Notes

**Release line:** `1.2.0-alpha.1`  
**Android versionCode:** `2`

## Financial record lifecycle

- Expense records can be edited by their submitter or the trip creator.
- Expense deletion is permanent and removes its allocation rows, revision snapshots, and ledger entries in the same database transaction.
- Pending payments can be edited by their payer or the trip creator. Payment participants cannot be changed by the edit operation.
- Confirmed, disputed, and cancelled payments are immutable through the edit API. This avoids rewriting a confirmed financial event without an explicit reversal workflow.
- Payment deletion is permanent and removes payment-linked settlement discounts and ledger entries. The existing payment DELETE route remains a cancellation operation for pending payments; permanent deletion uses the dedicated `/permanent` route.
- Trip deletion is restricted to the trip creator and permanently removes the trip's related financial and membership data.

## Conditional UI rules

- Expense edit/delete controls are shown only when the API reports that the current user is the submitter or trip creator.
- Payment edit is shown only for pending payments when the API grants permission.
- Confirm/dispute controls are shown only to the designated receiver for pending payments.
- Cancel remains a payer-only action for pending payments.
- Permanent payment deletion is shown only when the API grants permission.
- Add Expense is hidden for closed trips. Recording settlement payments remains available so closed trips can still be reconciled.

## Financial totals

The trip detail response now exposes `totalSpentPaise` as an alias for the authoritative sum of non-deleted expense amounts. The dashboard uses that field first, then the legacy `totalExpensePaise`, and only then a local expense-list fallback. Monetary values remain integer paise until display formatting.

## Transaction behavior

Prisma interactive transactions use a 10-second acquisition wait and 15-second execution timeout. External object-storage cleanup is kept outside database transactions. These limits are guardrails, not a replacement for keeping transactions short; remote database latency and connection-pool pressure still need monitoring.

## Validation status

The pull request CI workflow covers workspace typechecking, Prisma client generation, release-manifest validation, and API tests. No CI result should be considered passing until GitHub Actions completes for the pull request.
