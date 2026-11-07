CREATE TABLE IF NOT EXISTS installation_settings(version integer PRIMARY KEY CHECK(version>0),record jsonb NOT NULL);
DROP TRIGGER IF EXISTS immutable_installation ON installation_settings;
CREATE TRIGGER immutable_installation BEFORE UPDATE OR DELETE ON installation_settings
  FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
CREATE TABLE IF NOT EXISTS generation_admission_times(
  execution_id text PRIMARY KEY REFERENCES generation_heads(id), admitted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DROP TRIGGER IF EXISTS immutable_admission_times ON generation_admission_times;
CREATE TRIGGER immutable_admission_times BEFORE UPDATE OR DELETE ON generation_admission_times
  FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
