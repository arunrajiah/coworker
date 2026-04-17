import { uuid, text, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'

export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system', 'tool'])
export const messageChannelEnum = pgEnum('message_channel', ['web', 'telegram', 'whatsapp'])

export const messages = tenantSchema.table(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    threadId: uuid('thread_id').notNull(),
    toolCalls: jsonb('tool_calls'),
    agentRunId: uuid('agent_run_id'),
    channel: messageChannelEnum('channel').notNull().default('web'),
    externalMsgId: text('external_msg_id'),
    userId: uuid('user_id'),
    metadata: jsonb('metadata').$type<{ fileIds?: string[]; [key: string]: unknown }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index('messages_thread_idx').on(t.workspaceId, t.threadId),
  })
)

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
