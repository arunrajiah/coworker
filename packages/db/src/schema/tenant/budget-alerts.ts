import { uuid, text, integer, numeric, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'

export const budgetAlerts = tenantSchema.table(
  'budget_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    month: text('month').notNull(), // YYYY-MM
    thresholdPct: integer('threshold_pct').notNull(),
    spendUsd: numeric('spend_usd', { precision: 10, scale: 4 }).notNull(),
    budgetUsd: numeric('budget_usd', { precision: 10, scale: 4 }).notNull(),
    firedAt: timestamp('fired_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: unique().on(t.workspaceId, t.month, t.thresholdPct),
    workspaceMonthIdx: index('budget_alerts_workspace_month_idx').on(t.workspaceId, t.month),
  })
)

export type BudgetAlert = typeof budgetAlerts.$inferSelect
