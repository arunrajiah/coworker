import { uuid, text, timestamp, boolean, date, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'

export const taskStatusEnum = pgEnum('task_status', ['open', 'in_progress', 'done', 'cancelled'])
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent'])

export const tasks = tenantSchema.table(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: taskStatusEnum('status').notNull().default('open'),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    assigneeId: uuid('assignee_id'),
    agentOwned: boolean('agent_owned').notNull().default(false),
    dueDate: date('due_date'),
    labels: text('labels').array().notNull().default([]),
    parentId: uuid('parent_id'),
    metadata: jsonb('metadata'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('tasks_workspace_idx').on(t.workspaceId),
    statusIdx: index('tasks_status_idx').on(t.workspaceId, t.status),
  })
)

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
