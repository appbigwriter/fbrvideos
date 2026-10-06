CREATE TABLE IF NOT EXISTS assembly_runs(command_id text PRIMARY KEY, fingerprint text NOT NULL,
  production_id text NOT NULL REFERENCES production_heads(id), production_version integer NOT NULL,
  state text NOT NULL CHECK(state IN ('running','completed','failed')), lease_token text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, result jsonb, diagnostic text,
  CHECK((state='completed')=(result IS NOT NULL)));
CREATE INDEX IF NOT EXISTS assembly_production_idx ON assembly_runs(production_id,production_version);
