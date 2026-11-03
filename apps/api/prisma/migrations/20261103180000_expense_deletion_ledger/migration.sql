ALTER TABLE `Payment`
  ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `Payment_tripId_isDeleted_status_idx`
  ON `Payment`(`tripId`, `isDeleted`, `status`);

-- Add explicit ledger events for reversing soft-deleted expenses and payments.
ALTER TABLE `LedgerEntry`
  MODIFY `eventType` ENUM(
    'EXPENSE_CREATED',
    'EXPENSE_EDITED',
    'EXPENSE_DELETED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_DELETED',
    'SETTLEMENT_DISCOUNT'
  ) NOT NULL;
