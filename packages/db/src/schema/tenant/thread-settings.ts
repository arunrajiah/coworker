import { uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'
import { llmProviderEnum } from '../platform/workspaces'

// Per-thread model override. A row exists only while a thread overrides the
// workspace default; clearing the override deletes the row.
export const threadSettings = tenantSchema.table(
  'thread_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    threadId: text('thread_id').notNull(),
    llmProvider: llmProviderEnum('llm_provider'),
    llmModel: text('llm_model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: uniqueIndex('thread_settings_thread_idx').on(t.workspaceId, t.threadId),
  })
)

export type ThreadSettings = typeof threadSettings.$inferSelect
export type NewThreadSettings = typeof threadSettings.$inferInsert
