CREATE TABLE IF NOT EXISTS configuration_heads (
  kind text NOT NULL CHECK (kind IN ('articles','characters','references','profiles')),
  id text NOT NULL,
  version integer NOT NULL CHECK (version >= 0),
  PRIMARY KEY (kind, id)
);
CREATE TABLE IF NOT EXISTS configuration_revisions (
  kind text NOT NULL,
  id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  record jsonb NOT NULL,
  PRIMARY KEY (kind, id, version),
  FOREIGN KEY (kind, id) REFERENCES configuration_heads(kind, id),
  CHECK (record->>'id' = id AND (record->>'version')::integer = version)
);
CREATE TABLE IF NOT EXISTS configuration_commands (
  command_id text PRIMARY KEY,
  fingerprint text NOT NULL,
  result jsonb
);
CREATE TABLE IF NOT EXISTS character_bibles (
  hash text PRIMARY KEY,
  original text NOT NULL
);
CREATE OR REPLACE FUNCTION reject_configuration_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Immutable editorial record';
END;
$$;
DROP TRIGGER IF EXISTS immutable_revision ON configuration_revisions;
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON configuration_revisions
FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
DROP TRIGGER IF EXISTS immutable_bible ON character_bibles;
CREATE TRIGGER immutable_bible BEFORE UPDATE OR DELETE ON character_bibles
FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
