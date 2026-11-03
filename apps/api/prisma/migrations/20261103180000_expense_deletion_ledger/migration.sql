-- Add an explicit ledger event for reversing a soft-deleted expense.
ALTER TABLE `LedgerEntry`
  MODIFY `eventType` ENUM(
    'EXPENSE_CREATED',
    'EXPENSE_EDITED',
    'EXPENSE_DELETED',
    'PAYMENT_CONFIRMED',
    'SETTLEMENT_DISCOUNT'
  ) NOT NULL;
