CREATE TABLE IF NOT EXISTS generation_polls (
  execution_id text PRIMARY KEY REFERENCES generation_heads(id),
  failures integer NOT NULL DEFAULT 0,
  next_poll_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS assembly_evidence (
  command_id text PRIMARY KEY REFERENCES assembly_runs(command_id),
  production_id text NOT NULL REFERENCES production_heads(id),
  record jsonb NOT NULL
);
DROP TRIGGER IF EXISTS assembly_evidence_immutable ON assembly_evidence;
CREATE TRIGGER assembly_evidence_immutable BEFORE UPDATE OR DELETE ON assembly_evidence
FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
CREATE TABLE IF NOT EXISTS operational_samples (
  id text PRIMARY KEY,
  recorded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS operational_samples_time ON operational_samples(recorded_at DESC);
