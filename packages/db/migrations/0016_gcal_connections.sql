CREATE TABLE platform.gcal_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES platform.workspaces(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  refresh_token text NOT NULL,
  connected_by uuid NOT NULL REFERENCES platform.users(id) ON DELETE RESTRICT,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON platform.gcal_connections (workspace_id);
