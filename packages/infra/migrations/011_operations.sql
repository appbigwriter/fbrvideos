CREATE TABLE IF NOT EXISTS calibration_observations(
 id text NOT NULL,version integer NOT NULL CHECK(version>0),production_id text NOT NULL,
 production_version integer NOT NULL,profile_id text NOT NULL,profile_version integer NOT NULL,
 fingerprint text NOT NULL,record jsonb NOT NULL,PRIMARY KEY(id,version),
 FOREIGN KEY(production_id,production_version) REFERENCES production_revisions(id,version));
CREATE INDEX IF NOT EXISTS calibration_observations_scope ON calibration_observations(profile_id,profile_version,production_id,production_version,version DESC);
CREATE TABLE IF NOT EXISTS calibration_profile_decisions(
 id text PRIMARY KEY,profile_id text NOT NULL,profile_version integer NOT NULL,report_hash text NOT NULL,record jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS calibration_decisions_scope ON calibration_profile_decisions(profile_id,profile_version);
DROP TRIGGER IF EXISTS immutable_calibration_observation ON calibration_observations;
CREATE TRIGGER immutable_calibration_observation BEFORE UPDATE OR DELETE ON calibration_observations FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
DROP TRIGGER IF EXISTS immutable_calibration_decision ON calibration_profile_decisions;
CREATE TRIGGER immutable_calibration_decision BEFORE UPDATE OR DELETE ON calibration_profile_decisions FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
