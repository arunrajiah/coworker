import { bigint, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { platformSchema } from './_schema'
import { workspaces } from './workspaces'
import { users } from './users'

export const telegramConnections = platformSchema.table('telegram_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  telegramChatId: bigint('telegram_chat_id', { mode: 'number' }).notNull().unique(),
  telegramUsername: text('telegram_username'),
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
})

export type TelegramConnection = typeof telegramConnections.$inferSelect
export type NewTelegramConnection = typeof telegramConnections.$inferInsert
