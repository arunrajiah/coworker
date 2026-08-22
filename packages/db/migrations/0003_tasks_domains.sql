-- New task status values. Recreate the enum instead of ADD VALUE:
-- values added with ALTER TYPE ... ADD VALUE cannot be used later in the same
-- transaction, and the migrator runs all pending migrations in one transaction.
ALTER TABLE tenant.tasks ALTER COLUMN status DROP DEFAULT;
ALTER TABLE tenant.tasks ALTER COLUMN status SET DATA TYPE text;
DROP TYPE IF EXISTS task_status;
CREATE TYPE task_status AS ENUM ('open', 'backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled');
ALTER TABLE tenant.tasks ALTER COLUMN status SET DATA TYPE task_status USING status::task_status;
ALTER TABLE tenant.tasks ALTER COLUMN status SET DEFAULT 'todo';
