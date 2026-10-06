CREATE TABLE IF NOT EXISTS media_heads (
  kind text NOT NULL CHECK(kind IN ('asset','timeline','evaluation','approval')), id text NOT NULL,
  production_id text NOT NULL REFERENCES production_heads(id), version integer NOT NULL CHECK(version>=0),
  PRIMARY KEY(kind,id)
);
CREATE TABLE IF NOT EXISTS media_revisions (
  kind text NOT NULL, id text NOT NULL, version integer NOT NULL CHECK(version>0), record jsonb NOT NULL,
  PRIMARY KEY(kind,id,version), FOREIGN KEY(kind,id) REFERENCES media_heads(kind,id),
  CHECK(record->>'id'=id), CHECK((record->>'version')::integer=version)
);
CREATE INDEX IF NOT EXISTS media_production_idx ON media_heads(production_id);
DROP TRIGGER IF EXISTS immutable_media ON media_revisions;
CREATE TRIGGER immutable_media BEFORE UPDATE OR DELETE ON media_revisions
  FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
