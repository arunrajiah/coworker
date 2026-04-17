import { uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { platformSchema } from './_schema'
import { workspaces } from './workspaces'
import { users } from './users'

export const gitProviderEnum = pgEnum('git_provider', ['github', 'gitlab', 'bitbucket'])

export const gitConnections = platformSchema.table('git_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  provider: gitProviderEnum('provider').notNull(),
  repoOwner: text('repo_owner').notNull(),
  repoName: text('repo_name').notNull(),
  accessToken: text('access_token').notNull(),
  webhookSecret: text('webhook_secret').notNull(),
  connectedBy: uuid('connected_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
})

export type GitConnection = typeof gitConnections.$inferSelect
export type NewGitConnection = typeof gitConnections.$inferInsert
