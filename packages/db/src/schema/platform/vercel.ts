import { uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { platformSchema } from './_schema'

export const vercelConnections = platformSchema.table(
  'vercel_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    accessToken: text('access_token').notNull(),
    teamId: text('team_id'),
    teamSlug: text('team_slug'),
    teamName: text('team_name'),
    projectId: text('project_id').notNull(),
    projectName: text('project_name').notNull(),
    framework: text('framework'),
    gitConnectionId: uuid('git_connection_id'),
    connectedBy: uuid('connected_by').notNull(),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('vercel_connections_workspace_idx').on(t.workspaceId),
  })
)

export type VercelConnection = typeof vercelConnections.$inferSelect
export type NewVercelConnection = typeof vercelConnections.$inferInsert
