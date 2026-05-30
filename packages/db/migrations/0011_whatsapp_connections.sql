CREATE TABLE IF NOT EXISTS "platform"."whatsapp_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "platform"."workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "platform"."users"("id") ON DELETE CASCADE,
  "account_sid" text NOT NULL,
  "auth_token" text NOT NULL,
  "from_number" text NOT NULL,
  "connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
