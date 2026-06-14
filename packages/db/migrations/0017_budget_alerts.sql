-- Add budget config to workspaces
ALTER TABLE platform.workspaces
  ADD COLUMN monthly_budget_usd numeric(10, 4),
  ADD COLUMN budget_alert_threshold integer NOT NULL DEFAULT 80;

-- Store fired alerts (deduped per month)
CREATE TABLE tenant.budget_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  month text NOT NULL,           -- YYYY-MM
  threshold_pct integer NOT NULL, -- e.g. 80, 100
  spend_usd numeric(10, 4) NOT NULL,
  budget_usd numeric(10, 4) NOT NULL,
  fired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, month, threshold_pct)
);

CREATE INDEX ON tenant.budget_alerts (workspace_id, month);

-- Add cost + split token tracking to agent_runs
ALTER TABLE tenant.agent_runs
  ADD COLUMN prompt_tokens integer,
  ADD COLUMN completion_tokens integer,
  ADD COLUMN cost_usd numeric(10, 6);
