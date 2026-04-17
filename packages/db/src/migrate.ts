import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { VECTOR_SETUP_SQL } from './schema/tenant/memories'

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required')

  const sql = postgres(connectionString, { max: 1 })
  const db = drizzle(sql)

  console.log('Creating schemas...')
  await sql`CREATE SCHEMA IF NOT EXISTS platform`
  await sql`CREATE SCHEMA IF NOT EXISTS tenant`

  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './migrations' })

  console.log('Setting up pgvector...')
  await sql.unsafe(VECTOR_SETUP_SQL)

  console.log('Setting up Row Level Security...')
  await sql.unsafe(RLS_SETUP_SQL)

  await sql.end()
  console.log('Done.')
}

const RLS_SETUP_SQL = `
  ALTER TABLE tenant.tasks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tenant.messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tenant.agent_runs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tenant.memories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tenant.skills ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tenant.autopilot_rules ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tenant.files ENABLE ROW LEVEL SECURITY;

  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'workspace_isolation'
    ) THEN
      CREATE POLICY workspace_isolation ON tenant.tasks
        USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
      CREATE POLICY workspace_isolation ON tenant.messages
        USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
      CREATE POLICY workspace_isolation ON tenant.agent_runs
        USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
      CREATE POLICY workspace_isolation ON tenant.memories
        USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
      CREATE POLICY workspace_isolation ON tenant.skills
        USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
      CREATE POLICY workspace_isolation ON tenant.autopilot_rules
        USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
      CREATE POLICY workspace_isolation ON tenant.files
        USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
    END IF;
  END $$;
`

runMigrations().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
