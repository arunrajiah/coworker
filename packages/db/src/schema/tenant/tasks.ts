import { uuid, text, timestamp, boolean, date, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'

export const taskStatusEnum = pgEnum('task_status', [
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
  'cancelled',
])
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent'])
export const taskDomainEnum = pgEnum('task_domain', [
  'general',
  'development',
  'qa',
  'marketing',
  'finance',
  'design',
  'operations',
  'hr',
  'legal',
  'sales',
])

export const tasks = tenantSchema.table(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: taskStatusEnum('status').notNull().default('todo'),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    domain: taskDomainEnum('domain').notNull().default('general'),
    assigneeId: uuid('assignee_id'),
    agentOwned: boolean('agent_owned').notNull().default(false),
    // When true the worker will auto-execute this task via the agent
    queuedForAgent: boolean('queued_for_agent').notNull().default(false),
    dueDate: date('due_date'),
    labels: text('labels').array().notNull().default([]),
    parentId: uuid('parent_id'),
    agentNotes: text('agent_notes'),
    metadata: jsonb('metadata'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('tasks_workspace_idx').on(t.workspaceId),
    statusIdx: index('tasks_status_idx').on(t.workspaceId, t.status),
    domainIdx: index('tasks_domain_idx').on(t.workspaceId, t.domain),
  })
)

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
