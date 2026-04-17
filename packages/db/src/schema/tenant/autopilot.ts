import { uuid, text, timestamp, boolean, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'

export const autopilotTriggerEnum = pgEnum('autopilot_trigger', [
  'schedule',
  'task_created',
  'task_status_changed',
  'message_received',
  'git_issue_opened',
  'git_pr_opened',
])

export const autopilotActionEnum = pgEnum('autopilot_action', [
  'run_agent',
  'create_task',
  'send_message',
  'call_webhook',
])

export const autopilotRules = tenantSchema.table(
  'autopilot_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    triggerType: autopilotTriggerEnum('trigger_type').notNull(),
    triggerConfig: jsonb('trigger_config').notNull().default({}),
    actionType: autopilotActionEnum('action_type').notNull(),
    actionConfig: jsonb('action_config').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('autopilot_workspace_idx').on(t.workspaceId),
  })
)

export type AutopilotRule = typeof autopilotRules.$inferSelect
export type NewAutopilotRule = typeof autopilotRules.$inferInsert
