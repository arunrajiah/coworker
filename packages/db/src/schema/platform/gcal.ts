import { uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { platformSchema } from './_schema'
import { workspaces } from './workspaces'
import { users } from './users'

export const gcalConnections = platformSchema.table(
  'gcal_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    googleEmail: text('google_email').notNull(),
    clientId: text('client_id').notNull(),
    clientSecret: text('client_secret').notNull(),
    refreshToken: text('refresh_token').notNull(),
    connectedBy: uuid('connected_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('gcal_connections_workspace_idx').on(t.workspaceId),
  })
)

export type GcalConnection = typeof gcalConnections.$inferSelect
export type NewGcalConnection = typeof gcalConnections.$inferInsert
