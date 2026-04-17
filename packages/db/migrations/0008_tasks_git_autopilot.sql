-- Add git source tracking columns to tasks
ALTER TABLE tenant.tasks ADD COLUMN IF NOT EXISTS git_connection_id uuid;
ALTER TABLE tenant.tasks ADD COLUMN IF NOT EXISTS git_issue_number integer;
CREATE INDEX IF NOT EXISTS tasks_git_idx ON tenant.tasks (workspace_id, git_connection_id);

-- Extend autopilot trigger enum with git event types
ALTER TYPE tenant."autopilot_trigger" ADD VALUE IF NOT EXISTS 'git_issue_opened';
ALTER TYPE tenant."autopilot_trigger" ADD VALUE IF NOT EXISTS 'git_pr_opened';
