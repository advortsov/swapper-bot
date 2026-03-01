CREATE TABLE IF NOT EXISTS swap_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id),
  chain TEXT NOT NULL,
  from_symbol TEXT NOT NULL,
  to_symbol TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  raw_command TEXT NOT NULL,
  quote_snapshot JSONB NOT NULL,
  allowed_aggregators TEXT[] NOT NULL,
  best_aggregator TEXT NOT NULL,
  quote_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  selected_aggregator TEXT,
  selected_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS swap_intent_options (
  selection_token TEXT PRIMARY KEY,
  intent_id UUID NOT NULL REFERENCES swap_intents(id) ON DELETE CASCADE,
  aggregator TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS swap_intent_options_intent_id_aggregator_uidx
  ON swap_intent_options(intent_id, aggregator);

CREATE INDEX IF NOT EXISTS swap_intents_user_id_created_at_idx
  ON swap_intents(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS swap_intents_quote_expires_at_idx
  ON swap_intents(quote_expires_at);

CREATE TABLE IF NOT EXISTS swap_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES swap_intents(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  chain TEXT NOT NULL,
  aggregator TEXT NOT NULL,
  fee_mode TEXT NOT NULL,
  fee_bps INTEGER NOT NULL,
  fee_recipient TEXT,
  gross_to_amount TEXT NOT NULL,
  bot_fee_amount TEXT NOT NULL,
  net_to_amount TEXT NOT NULL,
  quote_payload_hash TEXT NOT NULL,
  swap_payload_hash TEXT NOT NULL,
  provider_reference TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS swap_executions_intent_id_idx
  ON swap_executions(intent_id);

CREATE INDEX IF NOT EXISTS swap_executions_user_id_created_at_idx
  ON swap_executions(user_id, created_at DESC);
