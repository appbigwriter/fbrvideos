CREATE TABLE IF NOT EXISTS production_budget_commands (
  command_id text PRIMARY KEY,
  production_id text NOT NULL REFERENCES production_heads(id),
  fingerprint text NOT NULL,
  record jsonb NOT NULL,
  result jsonb NOT NULL
);
DROP TRIGGER IF EXISTS production_budget_commands_immutable ON production_budget_commands;
CREATE TRIGGER production_budget_commands_immutable BEFORE UPDATE OR DELETE ON production_budget_commands
FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
