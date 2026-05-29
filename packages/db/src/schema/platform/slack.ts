import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { platformSchema } from './_schema'
import { workspaces } from './workspaces'
import { users } from './users'

export const slackConnections = platformSchema.table('slack_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Slack Bot User OAuth Token (xoxb-...) */
  botToken: text('bot_token').notNull(),
  /** Slack App-Level Token for Socket Mode (xapp-...) — optional */
  appToken: text('app_token'),
  /** Slack team/workspace name */
  teamName: text('team_name'),
  /** Slack team ID */
  teamId: text('team_id'),
  /** Slack Bot User ID */
  botUserId: text('bot_user_id'),
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
})

export type SlackConnection = typeof slackConnections.$inferSelect
export type NewSlackConnection = typeof slackConnections.$inferInsert
