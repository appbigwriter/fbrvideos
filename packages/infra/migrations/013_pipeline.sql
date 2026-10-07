CREATE TABLE IF NOT EXISTS pipeline_leases (
  production_id text PRIMARY KEY REFERENCES production_heads(id),
  token text NOT NULL,
  lease_until timestamptz NOT NULL
);
ALTER TABLE assembly_runs ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE IF NOT EXISTS pipeline_commands (
  command_id text PRIMARY KEY,
  production_id text NOT NULL REFERENCES production_heads(id),
  fingerprint text NOT NULL,
  result jsonb NOT NULL
);
DROP TRIGGER IF EXISTS pipeline_commands_immutable ON pipeline_commands;
CREATE TRIGGER pipeline_commands_immutable BEFORE UPDATE OR DELETE ON pipeline_commands
FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
CREATE TABLE IF NOT EXISTS source_edit_audits (
  command_id text PRIMARY KEY,
  production_id text NOT NULL REFERENCES production_heads(id),
  record jsonb NOT NULL
);
DROP TRIGGER IF EXISTS source_edit_audits_immutable ON source_edit_audits;
CREATE TRIGGER source_edit_audits_immutable BEFORE UPDATE OR DELETE ON source_edit_audits
FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
CREATE TABLE IF NOT EXISTS synthetic_generation_results (
  external_id text PRIMARY KEY,
  production_id text NOT NULL REFERENCES production_heads(id),
  fingerprint text NOT NULL,
  record jsonb NOT NULL
);
DROP TRIGGER IF EXISTS synthetic_generation_results_immutable ON synthetic_generation_results;
CREATE TRIGGER synthetic_generation_results_immutable BEFORE UPDATE OR DELETE ON synthetic_generation_results
FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
