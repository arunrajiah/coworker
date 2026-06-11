import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { memories } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'

export const memoryRoutes = new Hono()

memoryRoutes.use('*', authMiddleware)
memoryRoutes.use('*', workspaceMiddleware)

// List memories for a workspace (paginated, newest first)
memoryRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
  const offset = Number(c.req.query('offset') ?? 0)

  const rows = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.memories.findMany({
      where: eq(memories.workspaceId, workspaceId),
      orderBy: [desc(memories.createdAt)],
      limit,
      offset,
      columns: { id: true, content: true, sourceType: true, sourceId: true, metadata: true, createdAt: true },
    })
  )

  return c.json(rows)
})

// Delete a single memory
memoryRoutes.delete('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .delete(memories)
      .where(and(eq(memories.id, c.req.param('id')), eq(memories.workspaceId, workspaceId)))
  )

  return c.json({ ok: true })
})

// Delete all memories for a workspace
memoryRoutes.delete('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  await withWorkspace(db, workspaceId, async (tx) =>
    tx.delete(memories).where(eq(memories.workspaceId, workspaceId))
  )

  return c.json({ ok: true })
})
