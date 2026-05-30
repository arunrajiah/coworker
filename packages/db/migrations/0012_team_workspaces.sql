-- Extend template_type enum with new founder types
ALTER TYPE "platform"."template_type" ADD VALUE IF NOT EXISTS 'creator';
ALTER TYPE "platform"."template_type" ADD VALUE IF NOT EXISTS 'real_estate';

-- Workspace invitations
CREATE TABLE IF NOT EXISTS "platform"."workspace_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "platform"."workspaces"("id") ON DELETE CASCADE,
  "invited_by" uuid NOT NULL REFERENCES "platform"."users"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" "platform"."workspace_member_role" NOT NULL DEFAULT 'member',
  "token" text NOT NULL UNIQUE,
  "accepted_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workspace_invitations_token_idx" ON "platform"."workspace_invitations" ("token");
CREATE INDEX IF NOT EXISTS "workspace_invitations_workspace_idx" ON "platform"."workspace_invitations" ("workspace_id");
