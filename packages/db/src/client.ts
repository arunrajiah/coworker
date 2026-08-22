import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from './schema/index'

export type DbClient = ReturnType<typeof createClient>

export function createClient(connectionString: string) {
  const sql = postgres(connectionString, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
  })

  return drizzle(sql, {
    schema,
    logger: process.env.NODE_ENV === 'development',
  })
}

// Set the RLS workspace context for the current transaction/session
export async function withWorkspace<T>(
  db: DbClient,
  workspaceId: string,
  fn: (db: DbClient) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config with a bound parameter; SET LOCAL cannot take parameters.
    await tx.execute(sql`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`)
    return fn(tx as unknown as DbClient)
  })
}

// Explicit cross-workspace access for trusted system jobs (schedulers, lookups
// where the workspace is not yet known). Tenant tables FORCE row level security,
// so any query outside withWorkspace/withSystemContext returns no rows.
export async function withSystemContext<T>(
  db: DbClient,
  fn: (db: DbClient) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.system_context', 'on', true)`)
    return fn(tx as unknown as DbClient)
  })
}
