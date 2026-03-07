ALTER TABLE price_alerts
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'fixed',
  ADD COLUMN direction TEXT,
  ADD COLUMN percentage_change NUMERIC,
  ADD COLUMN repeatable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN quiet_hours_start TEXT,
  ADD COLUMN quiet_hours_end TEXT,
  ADD COLUMN watch_token_address TEXT,
  ADD COLUMN watch_chain TEXT;
