CREATE TABLE platform.linear_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES platform.workspaces(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  team_name text NOT NULL,
  api_key text NOT NULL,
  connected_by uuid NOT NULL REFERENCES platform.users(id) ON DELETE RESTRICT,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON platform.linear_connections (workspace_id);
