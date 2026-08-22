import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { VECTOR_SETUP_SQL } from './schema/tenant/memories'

// Resolve relative to this file so the migrator works from any cwd
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations')

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required')

  const sql = postgres(connectionString, { max: 1 })
  const db = drizzle(sql)

  console.log('Creating schemas...')
  await sql`CREATE SCHEMA IF NOT EXISTS platform`
  await sql`CREATE SCHEMA IF NOT EXISTS tenant`

  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR })

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
  ALTER TABLE tenant.thread_settings ENABLE ROW LEVEL SECURITY;

  -- FORCE applies RLS to the table owner too; without it, an owner connection bypasses every policy.
  ALTER TABLE tenant.tasks FORCE ROW LEVEL SECURITY;
  ALTER TABLE tenant.messages FORCE ROW LEVEL SECURITY;
  ALTER TABLE tenant.agent_runs FORCE ROW LEVEL SECURITY;
  ALTER TABLE tenant.memories FORCE ROW LEVEL SECURITY;
  ALTER TABLE tenant.skills FORCE ROW LEVEL SECURITY;
  ALTER TABLE tenant.autopilot_rules FORCE ROW LEVEL SECURITY;
  ALTER TABLE tenant.files FORCE ROW LEVEL SECURITY;
  ALTER TABLE tenant.thread_settings FORCE ROW LEVEL SECURITY;

  -- Recreate policies so existing databases pick up definition changes.
  -- Rows are visible when the transaction's workspace context matches, or when the
  -- worker explicitly opts into cross-workspace system context (withSystemContext).
  DO $$
  DECLARE t text;
  BEGIN
    FOREACH t IN ARRAY ARRAY['tasks','messages','agent_runs','memories','skills','autopilot_rules','files','thread_settings'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS workspace_isolation ON tenant.%I', t);
      EXECUTE format(
        'CREATE POLICY workspace_isolation ON tenant.%I USING (
          workspace_id = current_setting(''app.current_workspace_id'', true)::uuid
          OR current_setting(''app.system_context'', true) = ''on''
        )', t);
    END LOOP;
  END $$;
`

runMigrations().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
