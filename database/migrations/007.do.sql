CREATE TABLE IF NOT EXISTS trade_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  chain TEXT NOT NULL,
  sell_token_address TEXT NOT NULL,
  buy_token_address TEXT NOT NULL,
  default_amount TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_presets_user_created_at_idx
  ON trade_presets(user_id, created_at DESC);
