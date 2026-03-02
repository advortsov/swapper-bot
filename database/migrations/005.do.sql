CREATE TABLE IF NOT EXISTS favorite_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  amount TEXT NOT NULL,
  from_token_chain TEXT NOT NULL,
  from_token_address TEXT NOT NULL,
  to_token_chain TEXT NOT NULL,
  to_token_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS favorite_pairs_user_pair_uidx
  ON favorite_pairs(user_id, chain, amount, from_token_address, to_token_address);

CREATE INDEX IF NOT EXISTS favorite_pairs_user_created_at_idx
  ON favorite_pairs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  favorite_id UUID NOT NULL REFERENCES favorite_pairs(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_to_amount TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  triggered_at TIMESTAMPTZ,
  last_observed_net_to_amount TEXT,
  last_observed_aggregator TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS price_alerts_favorite_id_active_uidx
  ON price_alerts(favorite_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS price_alerts_status_updated_at_idx
  ON price_alerts(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS price_alerts_user_created_at_idx
  ON price_alerts(user_id, created_at DESC);
