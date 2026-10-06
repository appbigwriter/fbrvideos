CREATE TABLE IF NOT EXISTS production_heads (id text PRIMARY KEY, version integer NOT NULL CHECK(version >= 0));
CREATE TABLE IF NOT EXISTS production_revisions (
  id text NOT NULL REFERENCES production_heads(id), version integer NOT NULL CHECK(version > 0), record jsonb NOT NULL,
  PRIMARY KEY(id,version), CHECK(record->>'id'=id), CHECK((record->>'version')::integer=version)
);
CREATE TABLE IF NOT EXISTS production_snapshots (production_id text PRIMARY KEY, record jsonb NOT NULL,
  CHECK(record->>'production_id'=production_id));
CREATE TABLE IF NOT EXISTS production_events (id text PRIMARY KEY, production_id text NOT NULL, version integer NOT NULL,
  record jsonb NOT NULL, UNIQUE(production_id,version), FOREIGN KEY(production_id,version) REFERENCES production_revisions(id,version));
CREATE TABLE IF NOT EXISTS production_dossiers (id text NOT NULL, version integer NOT NULL CHECK(version>0), record jsonb NOT NULL,
  PRIMARY KEY(id,version), CHECK(record->>'id'=id), CHECK((record->>'version')::integer=version));
CREATE TABLE IF NOT EXISTS production_commands (command_id text PRIMARY KEY, fingerprint text NOT NULL, result jsonb);
DROP TRIGGER IF EXISTS immutable_productions ON production_revisions;
CREATE TRIGGER immutable_productions BEFORE UPDATE OR DELETE ON production_revisions FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
DROP TRIGGER IF EXISTS immutable_snapshots ON production_snapshots;
CREATE TRIGGER immutable_snapshots BEFORE UPDATE OR DELETE ON production_snapshots FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
DROP TRIGGER IF EXISTS immutable_events ON production_events;
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON production_events FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
DROP TRIGGER IF EXISTS immutable_dossiers ON production_dossiers;
CREATE TRIGGER immutable_dossiers BEFORE UPDATE OR DELETE ON production_dossiers FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
