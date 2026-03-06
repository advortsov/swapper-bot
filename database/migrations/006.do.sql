CREATE TABLE tracked_transactions (
  hash TEXT NOT NULL,
  chain TEXT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id),
  execution_id UUID NOT NULL REFERENCES swap_executions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  block_number BIGINT,
  gas_used TEXT,
  effective_gas_price TEXT,
  error_message TEXT,
  PRIMARY KEY (chain, hash)
);

CREATE INDEX idx_tracked_transactions_pending ON tracked_transactions (status) WHERE status = 'pending';
CREATE INDEX idx_tracked_transactions_user ON tracked_transactions (user_id, submitted_at DESC);
CREATE INDEX idx_tracked_transactions_execution ON tracked_transactions (execution_id);

ALTER TABLE swap_executions
  ADD COLUMN transaction_status TEXT,
  ADD COLUMN confirmed_at TIMESTAMPTZ,
  ADD COLUMN gas_used TEXT,
  ADD COLUMN effective_gas_price TEXT;
