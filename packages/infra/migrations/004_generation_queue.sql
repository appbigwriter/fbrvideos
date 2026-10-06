CREATE TABLE IF NOT EXISTS generation_heads (
  id text PRIMARY KEY, production_id text NOT NULL REFERENCES production_heads(id),
  execution_key text NOT NULL, attempt integer NOT NULL CHECK(attempt>0),
  fingerprint text NOT NULL, version integer NOT NULL CHECK(version>0),
  UNIQUE(execution_key,attempt)
);
CREATE TABLE IF NOT EXISTS generation_revisions (
  id text NOT NULL REFERENCES generation_heads(id), version integer NOT NULL CHECK(version>0),
  record jsonb NOT NULL, PRIMARY KEY(id,version),
  CHECK(record->>'id'=id), CHECK((record->>'version')::integer=version)
);
CREATE INDEX IF NOT EXISTS generation_production_idx ON generation_heads(production_id);
DROP TRIGGER IF EXISTS immutable_generation ON generation_revisions;
CREATE TRIGGER immutable_generation BEFORE UPDATE OR DELETE ON generation_revisions
  FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
