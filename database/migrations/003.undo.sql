ALTER TABLE tokens
  DROP CONSTRAINT IF EXISTS tokens_pkey;

ALTER TABLE tokens
  ADD CONSTRAINT tokens_pkey PRIMARY KEY (address);
