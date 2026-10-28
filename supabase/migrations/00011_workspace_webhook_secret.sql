-- Add workspace-level webhook token. Repliz sends one token per workspace in
-- the x-token header; /api/webhooks/repliz rejects requests that do not match.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
