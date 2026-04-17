import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { agentRuns } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'

export const activityRoutes = new Hono()

activityRoutes.use('*', authMiddleware)
activityRoutes.use('*', workspaceMiddleware)

// Returns a log of what the coworker has done — agent runs with status + token usage
activityRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  const runs = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.agentRuns.findMany({
      where: and(
        eq(agentRuns.workspaceId, workspaceId),
        eq(agentRuns.status, 'completed')
      ),
      orderBy: [desc(agentRuns.createdAt)],
      limit: 50,
      columns: {
        id: true,
        trigger: true,
        status: true,
        input: true,
        output: true,
        tokensUsed: true,
        durationMs: true,
        createdAt: true,
        completedAt: true,
      },
    })
  )

  return c.json(runs)
})
