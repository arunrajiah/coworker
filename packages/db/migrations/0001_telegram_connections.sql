CREATE TABLE IF NOT EXISTS "platform"."telegram_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "platform"."workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "platform"."users"("id") ON DELETE CASCADE,
  "telegram_chat_id" bigint NOT NULL,
  "telegram_username" text,
  "connected_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "telegram_connections_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
