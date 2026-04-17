import { uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'

export const skills = tenantSchema.table(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    prompt: text('prompt').notNull(),
    triggerPhrase: text('trigger_phrase'),
    tools: text('tools').array().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('skills_workspace_idx').on(t.workspaceId),
  })
)

export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert
