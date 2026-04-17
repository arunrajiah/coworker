-- New task status values (extend existing enum)
-- These must be committed before they can be used in the same migration.
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'backlog';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'todo';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'review';
