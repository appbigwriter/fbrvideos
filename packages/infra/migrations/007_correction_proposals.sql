CREATE TABLE IF NOT EXISTS correction_proposal_heads(id text PRIMARY KEY, production_id text NOT NULL REFERENCES production_heads(id),
  point_id text NOT NULL REFERENCES review_point_heads(id), version integer NOT NULL CHECK(version>0), UNIQUE(production_id,point_id));
CREATE TABLE IF NOT EXISTS correction_proposal_revisions(id text NOT NULL REFERENCES correction_proposal_heads(id), version integer NOT NULL CHECK(version>0), record jsonb NOT NULL,
  PRIMARY KEY(id,version), CHECK(record->>'id'=id), CHECK((record->>'version')::integer=version));
DROP TRIGGER IF EXISTS immutable_correction_proposal ON correction_proposal_revisions;
CREATE TRIGGER immutable_correction_proposal BEFORE UPDATE OR DELETE ON correction_proposal_revisions FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
