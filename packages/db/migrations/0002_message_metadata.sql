-- Add metadata column to messages for storing file attachment IDs and other per-message context
ALTER TABLE tenant.messages ADD COLUMN IF NOT EXISTS "metadata" jsonb;
