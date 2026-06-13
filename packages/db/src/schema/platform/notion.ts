import { uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { platformSchema } from './_schema'
import { workspaces } from './workspaces'
import { users } from './users'

export const notionConnections = platformSchema.table(
  'notion_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    notionWorkspaceId: text('notion_workspace_id').notNull(),
    notionWorkspaceName: text('notion_workspace_name').notNull(),
    accessToken: text('access_token').notNull(),
    botId: text('bot_id').notNull(),
    connectedBy: uuid('connected_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('notion_connections_workspace_idx').on(t.workspaceId),
  })
)

export type NotionConnection = typeof notionConnections.$inferSelect
export type NewNotionConnection = typeof notionConnections.$inferInsert
