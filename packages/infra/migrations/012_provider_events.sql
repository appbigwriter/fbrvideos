CREATE TABLE IF NOT EXISTS provider_normalized_receipts (
  adapter_id text NOT NULL, external_id text NOT NULL, execution_key text NOT NULL,
  attempt integer NOT NULL CHECK(attempt>0), record jsonb NOT NULL,
  PRIMARY KEY(adapter_id,external_id), UNIQUE(adapter_id,execution_key,attempt)
);
CREATE TABLE IF NOT EXISTS provider_callback_inbox (
  adapter_id text NOT NULL, event_id text NOT NULL, execution_id text NOT NULL,
  payload_hash text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz, attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz, lease_token text, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  diagnostic text, PRIMARY KEY(adapter_id,event_id)
);
CREATE INDEX IF NOT EXISTS provider_callback_due ON provider_callback_inbox(next_attempt_at) WHERE processed_at IS NULL;
CREATE TABLE IF NOT EXISTS provider_quotes (
  adapter_id text NOT NULL, execution_key text NOT NULL, attempt integer NOT NULL,
  record jsonb NOT NULL, PRIMARY KEY(adapter_id,execution_key,attempt)
);
