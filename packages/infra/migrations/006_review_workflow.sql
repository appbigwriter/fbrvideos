CREATE TABLE IF NOT EXISTS review_commands(command_id text PRIMARY KEY, fingerprint text NOT NULL, result jsonb);
CREATE TABLE IF NOT EXISTS review_point_heads(id text PRIMARY KEY, production_id text NOT NULL REFERENCES production_heads(id), version integer NOT NULL CHECK(version>0));
CREATE TABLE IF NOT EXISTS review_point_revisions(id text NOT NULL REFERENCES review_point_heads(id), version integer NOT NULL CHECK(version>0), record jsonb NOT NULL,
  PRIMARY KEY(id,version), CHECK(record->>'id'=id), CHECK((record->>'version')::integer=version));
CREATE INDEX IF NOT EXISTS review_point_production_idx ON review_point_heads(production_id);
DROP TRIGGER IF EXISTS immutable_review_point ON review_point_revisions;
CREATE TRIGGER immutable_review_point BEFORE UPDATE OR DELETE ON review_point_revisions FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
CREATE TABLE IF NOT EXISTS delivery_manifests(id text PRIMARY KEY, production_id text NOT NULL REFERENCES production_heads(id), render_id text NOT NULL,
  render_version integer NOT NULL, storage_key text NOT NULL, hash text NOT NULL, record jsonb NOT NULL);
DROP TRIGGER IF EXISTS immutable_delivery ON delivery_manifests;
CREATE TRIGGER immutable_delivery BEFORE UPDATE OR DELETE ON delivery_manifests FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
