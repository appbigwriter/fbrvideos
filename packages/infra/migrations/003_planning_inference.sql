CREATE TABLE IF NOT EXISTS planning_inferences (
  execution_key text PRIMARY KEY,
  fingerprint text NOT NULL,
  state text NOT NULL CHECK (state IN ('running','completed','failed')),
  started_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  result jsonb,
  CHECK ((state = 'completed') = (result IS NOT NULL))
);
CREATE OR REPLACE FUNCTION protect_planning_inference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.state <> 'running' THEN
    RAISE EXCEPTION 'Immutable inference evidence';
  END IF;
  IF NEW.execution_key <> OLD.execution_key OR NEW.fingerprint <> OLD.fingerprint OR NEW.started_at <> OLD.started_at THEN
    RAISE EXCEPTION 'Immutable inference identity';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS planning_inferences_guard ON planning_inferences;
CREATE TRIGGER planning_inferences_guard BEFORE UPDATE OR DELETE ON planning_inferences
  FOR EACH ROW EXECUTE FUNCTION protect_planning_inference();
