import { uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { platformSchema } from './_schema'
import { workspaces } from './workspaces'
import { users } from './users'

export const linearConnections = platformSchema.table(
  'linear_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    teamId: text('team_id').notNull(),
    teamName: text('team_name').notNull(),
    apiKey: text('api_key').notNull(),
    connectedBy: uuid('connected_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('linear_connections_workspace_idx').on(t.workspaceId),
  })
)

export type LinearConnection = typeof linearConnections.$inferSelect
export type NewLinearConnection = typeof linearConnections.$inferInsert
