CREATE TYPE platform."git_provider" AS ENUM ('github', 'gitlab', 'bitbucket');

CREATE TABLE platform.git_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES platform.workspaces(id) ON DELETE CASCADE,
  provider platform."git_provider" NOT NULL,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  access_token text NOT NULL,
  webhook_secret text NOT NULL,
  connected_by uuid NOT NULL REFERENCES platform.users(id) ON DELETE RESTRICT,
  connected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON platform.git_connections (workspace_id);
