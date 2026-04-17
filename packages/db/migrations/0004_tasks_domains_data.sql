-- Domain enum
DO $$ BEGIN
  CREATE TYPE task_domain AS ENUM (
    'general', 'development', 'qa', 'marketing', 'finance',
    'design', 'operations', 'hr', 'legal', 'sales'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Migrate existing 'open' tasks to 'todo'
UPDATE tenant.tasks SET status = 'todo' WHERE status = 'open';

-- New columns
ALTER TABLE tenant.tasks
  ADD COLUMN IF NOT EXISTS "domain" task_domain NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS "queued_for_agent" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "agent_notes" text;

-- New indexes
CREATE INDEX IF NOT EXISTS tasks_domain_idx ON tenant.tasks (workspace_id, domain);
