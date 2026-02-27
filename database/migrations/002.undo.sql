DROP INDEX IF EXISTS tokens_chain_symbol_idx;

ALTER TABLE tokens
  DROP CONSTRAINT IF EXISTS tokens_symbol_key;

ALTER TABLE tokens
  ADD CONSTRAINT tokens_symbol_key UNIQUE (symbol);

CREATE INDEX IF NOT EXISTS tokens_chain_symbol_idx ON tokens(chain, symbol);
