-- Idempotency ledger for inbound Repliz webhook deliveries. Repliz does not
-- retry, but a delivery can still be duplicated or arrive out of order, so the
-- receiver claims the event id here before processing to avoid re-running a
-- flow (which would double-send DMs).
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rows are only needed for the retry window (hours); allow cheap pruning.
CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx ON webhook_events (received_at);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
