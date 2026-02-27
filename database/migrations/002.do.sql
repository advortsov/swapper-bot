ALTER TABLE tokens
  DROP CONSTRAINT IF EXISTS tokens_symbol_key;

DROP INDEX IF EXISTS tokens_chain_symbol_idx;

CREATE UNIQUE INDEX IF NOT EXISTS tokens_chain_symbol_idx ON tokens(chain, symbol);
