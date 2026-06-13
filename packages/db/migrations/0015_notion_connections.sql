CREATE TABLE platform.notion_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES platform.workspaces(id) ON DELETE CASCADE,
  notion_workspace_id text NOT NULL,
  notion_workspace_name text NOT NULL,
  access_token text NOT NULL,
  bot_id text NOT NULL,
  connected_by uuid NOT NULL REFERENCES platform.users(id) ON DELETE RESTRICT,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON platform.notion_connections (workspace_id);
