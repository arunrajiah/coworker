import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { platformSchema } from './_schema'
import { workspaces } from './workspaces'
import { users } from './users'

export const whatsappConnections = platformSchema.table('whatsapp_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Twilio Account SID */
  accountSid: text('account_sid').notNull(),
  /** Twilio Auth Token */
  authToken: text('auth_token').notNull(),
  /** WhatsApp-enabled Twilio number, e.g. whatsapp:+14155238886 */
  fromNumber: text('from_number').notNull(),
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
})

export type WhatsappConnection = typeof whatsappConnections.$inferSelect
export type NewWhatsappConnection = typeof whatsappConnections.$inferInsert
