import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { workspaces, budgetAlerts } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'

export const usageRoutes = new Hono()

usageRoutes.use('*', authMiddleware)
usageRoutes.use('*', workspaceMiddleware)

// GET /api/workspaces/:slug/usage?month=YYYY-MM
usageRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  const month = (c.req.query('month') ?? new Date().toISOString().slice(0, 7))

  const [ws, spendRow, dailyRows, alerts] = await Promise.all([
    db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
      columns: { monthlyBudgetUsd: true, budgetAlertThreshold: true },
    }),
    withWorkspace(db, workspaceId, async (tx) =>
      tx.execute(sql`
        SELECT
          COUNT(*) AS run_count,
          COALESCE(SUM(tokens_used), 0) AS total_tokens,
          COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
          COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
          COALESCE(SUM(cost_usd::numeric), 0) AS total_cost
        FROM tenant.agent_runs
        WHERE workspace_id = ${workspaceId}::uuid
          AND to_char(created_at, 'YYYY-MM') = ${month}
          AND status = 'completed'
      `)
    ),
    withWorkspace(db, workspaceId, async (tx) =>
      tx.execute(sql`
        SELECT
          to_char(created_at, 'YYYY-MM-DD') AS day,
          COUNT(*) AS runs,
          COALESCE(SUM(cost_usd::numeric), 0) AS cost
        FROM tenant.agent_runs
        WHERE workspace_id = ${workspaceId}::uuid
          AND to_char(created_at, 'YYYY-MM') = ${month}
          AND status = 'completed'
        GROUP BY day
        ORDER BY day
      `)
    ),
    db.query.budgetAlerts.findMany({
      where: (t, { and, eq }) =>
        and(eq(t.workspaceId, workspaceId), eq(t.month, month)),
      orderBy: (t, { desc }) => [desc(t.firedAt)],
    }),
  ])

  const spend = spendRow.rows[0] as {
    run_count: string
    total_tokens: string
    prompt_tokens: string
    completion_tokens: string
    total_cost: string
  }

  return c.json({
    month,
    runCount: Number(spend.run_count),
    totalTokens: Number(spend.total_tokens),
    promptTokens: Number(spend.prompt_tokens),
    completionTokens: Number(spend.completion_tokens),
    totalCostUsd: Number(spend.total_cost),
    monthlyBudgetUsd: ws?.monthlyBudgetUsd ? Number(ws.monthlyBudgetUsd) : null,
    budgetAlertThreshold: ws?.budgetAlertThreshold ?? 80,
    daily: (dailyRows.rows as { day: string; runs: string; cost: string }[]).map((r) => ({
      day: r.day,
      runs: Number(r.runs),
      costUsd: Number(r.cost),
    })),
    alerts,
  })
})
