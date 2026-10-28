-- Repliz is the messaging provider.
--
-- Fresh databases already get the repliz_* columns from 00001. The renames
-- below only matter for a local database created before the switch, so they
-- stay idempotent and are a no-op everywhere else.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name = 'late_api_key_encrypted'
  ) THEN
    ALTER TABLE workspaces RENAME COLUMN late_api_key_encrypted TO repliz_access_key_encrypted;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channels' AND column_name = 'late_account_id'
  ) THEN
    ALTER TABLE channels RENAME COLUMN late_account_id TO repliz_account_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'late_conversation_id'
  ) THEN
    ALTER TABLE conversations RENAME COLUMN late_conversation_id TO repliz_chat_id;
  END IF;
END $$;

-- Repliz uses an Access Key + Secret Key pair (HTTP Basic auth).
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS repliz_secret_key_encrypted TEXT;

-- `webhook_secret` now holds the token Repliz sends in the x-token header.
COMMENT ON COLUMN workspaces.webhook_secret IS
  'Repliz webhook token (x-token header). One per workspace.';

-- Repliz can drive DMs for Instagram, Facebook, Telegram and TikTok. Older
-- platform values stay allowed so existing channel rows are not invalidated.
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_platform_check;
ALTER TABLE channels ADD CONSTRAINT channels_platform_check
  CHECK (platform IN (
    'facebook', 'instagram', 'tiktok', 'telegram',
    'twitter', 'bluesky', 'reddit', 'whatsapp'
  ));

CREATE INDEX IF NOT EXISTS idx_conversations_repliz_chat_id
  ON conversations(repliz_chat_id);
