ALTER TABLE price_alerts
  DROP COLUMN IF EXISTS kind,
  DROP COLUMN IF EXISTS direction,
  DROP COLUMN IF EXISTS percentage_change,
  DROP COLUMN IF EXISTS repeatable,
  DROP COLUMN IF EXISTS quiet_hours_start,
  DROP COLUMN IF EXISTS quiet_hours_end,
  DROP COLUMN IF EXISTS watch_token_address,
  DROP COLUMN IF EXISTS watch_chain;
