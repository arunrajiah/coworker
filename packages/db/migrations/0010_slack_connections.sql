-- Add slack to the message channel enum
ALTER TYPE "tenant"."message_channel" ADD VALUE IF NOT EXISTS 'slack';

CREATE TABLE IF NOT EXISTS "platform"."slack_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "platform"."workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "platform"."users"("id") ON DELETE CASCADE,
  "bot_token" text NOT NULL,
  "app_token" text,
  "team_name" text,
  "team_id" text,
  "bot_user_id" text,
  "connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
