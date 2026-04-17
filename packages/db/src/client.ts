import { drizzle } from 'drizzle-orm/postgres-js'
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
    await tx.execute(`SET LOCAL app.current_workspace_id = '${workspaceId}'`)
    return fn(tx as unknown as DbClient)
  })
}
