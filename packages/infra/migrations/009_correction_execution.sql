CREATE TABLE IF NOT EXISTS correction_execution_plans(
  id text PRIMARY KEY, correction_id text NOT NULL REFERENCES correction_proposal_heads(id),
  production_id text NOT NULL REFERENCES production_heads(id), hash text NOT NULL, record jsonb NOT NULL,
  UNIQUE(correction_id,hash), CHECK(record->>'id'=id), CHECK(record->>'hash'=hash));
CREATE INDEX IF NOT EXISTS correction_execution_production ON correction_execution_plans(production_id);
DROP TRIGGER IF EXISTS immutable_correction_execution_plan ON correction_execution_plans;
CREATE TRIGGER immutable_correction_execution_plan BEFORE UPDATE OR DELETE ON correction_execution_plans FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
ALTER TABLE correction_proposal_heads ALTER COLUMN point_id DROP NOT NULL;
