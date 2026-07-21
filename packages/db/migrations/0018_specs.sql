-- Spec types
CREATE TYPE tenant.spec_type AS ENUM ('requirement', 'blueprint', 'feedback');
CREATE TYPE tenant.spec_status AS ENUM ('draft', 'active', 'deprecated');

-- Specs table
CREATE TABLE tenant.specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  type tenant.spec_type NOT NULL DEFAULT 'requirement',
  status tenant.spec_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON tenant.specs (workspace_id);
CREATE INDEX ON tenant.specs (workspace_id, type);

-- Enrich tasks with spec link + acceptance criteria
ALTER TABLE tenant.tasks
  ADD COLUMN spec_id uuid,
  ADD COLUMN acceptance_criteria text;
