ALTER TABLE swap_executions
  DROP COLUMN IF EXISTS effective_gas_price,
  DROP COLUMN IF EXISTS gas_used,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS transaction_status;

DROP INDEX IF EXISTS idx_tracked_transactions_execution;
DROP INDEX IF EXISTS idx_tracked_transactions_user;
DROP INDEX IF EXISTS idx_tracked_transactions_pending;
DROP TABLE IF EXISTS tracked_transactions;
