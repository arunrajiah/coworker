import { uuid, text, timestamp, integer, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'

export const agentRunStatusEnum = pgEnum('agent_run_status', [
  'queued',
  'running',
  'completed',
  'failed',
])

export const agentRunTriggerEnum = pgEnum('agent_run_trigger', [
  'user_message',
  'autopilot',
  'scheduled',
  'webhook',
])

export const agentRuns = tenantSchema.table(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    trigger: agentRunTriggerEnum('trigger').notNull().default('user_message'),
    status: agentRunStatusEnum('status').notNull().default('queued'),
    input: text('input'),
    output: text('output'),
    toolCalls: jsonb('tool_calls'),
    tokensUsed: integer('tokens_used'),
    durationMs: integer('duration_ms'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('agent_runs_workspace_idx').on(t.workspaceId, t.createdAt),
  })
)

export type AgentRun = typeof agentRuns.$inferSelect
export type NewAgentRun = typeof agentRuns.$inferInsert
