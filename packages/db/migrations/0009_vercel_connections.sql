CREATE TABLE IF NOT EXISTS platform.vercel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  access_token text NOT NULL,
  team_id text,
  team_slug text,
  team_name text,
  project_id text NOT NULL,
  project_name text NOT NULL,
  framework text,
  git_connection_id uuid,
  connected_by uuid NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vercel_connections_workspace_idx ON platform.vercel_connections (workspace_id);
