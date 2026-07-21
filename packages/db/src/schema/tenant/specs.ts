import { uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'

export const specTypeEnum = pgEnum('spec_type', ['requirement', 'blueprint', 'feedback'])
export const specStatusEnum = pgEnum('spec_status', ['draft', 'active', 'deprecated'])

export const specs = tenantSchema.table(
  'specs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull().default(''),
    type: specTypeEnum('type').notNull().default('requirement'),
    status: specStatusEnum('status').notNull().default('draft'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('specs_workspace_idx').on(t.workspaceId),
    typeIdx: index('specs_type_idx').on(t.workspaceId, t.type),
  })
)

export type Spec = typeof specs.$inferSelect
export type NewSpec = typeof specs.$inferInsert
