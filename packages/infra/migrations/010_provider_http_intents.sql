CREATE TABLE IF NOT EXISTS provider_http_intents(
  adapter_id text NOT NULL,execution_key text NOT NULL,attempt integer NOT NULL CHECK(attempt>0),
  production_id text NOT NULL REFERENCES production_heads(id),fingerprint text NOT NULL,record jsonb NOT NULL,
  PRIMARY KEY(adapter_id,execution_key,attempt));
CREATE INDEX IF NOT EXISTS provider_http_intents_production ON provider_http_intents(production_id);
DROP TRIGGER IF EXISTS immutable_provider_http_intent ON provider_http_intents;
CREATE TRIGGER immutable_provider_http_intent BEFORE UPDATE OR DELETE ON provider_http_intents FOR EACH ROW EXECUTE FUNCTION reject_configuration_mutation();
