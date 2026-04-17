import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, desc, asc } from 'drizzle-orm'
import { tasks } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'
import { withWorkspace } from '@coworker/db'

export const taskRoutes = new Hono()

taskRoutes.use('*', authMiddleware)
taskRoutes.use('*', workspaceMiddleware)

const taskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(),
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  labels: z.array(z.string()).optional(),
  parentId: z.string().uuid().optional(),
})

// List tasks
taskRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const { status, priority } = c.req.query()

  const result = await withWorkspace(db, workspaceId, async (tx) => {
    const conditions = [eq(tasks.workspaceId, workspaceId)]
    if (status) conditions.push(eq(tasks.status, status as any))
    if (priority) conditions.push(eq(tasks.priority, priority as any))

    return tx.query.tasks.findMany({
      where: and(...conditions),
      orderBy: [asc(tasks.status), desc(tasks.createdAt)],
    })
  })

  return c.json(result)
})

// Create task
taskRoutes.post('/', zValidator('json', taskSchema), async (c) => {
  const workspaceId = c.get('workspaceId')
  const user = c.get('user')
  const body = c.req.valid('json')
  const { db } = getContainer()

  const [task] = await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .insert(tasks)
      .values({
        workspaceId,
        createdBy: user.sub,
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? 'open',
        priority: body.priority ?? 'medium',
        assigneeId: body.assigneeId ?? null,
        dueDate: body.dueDate ?? null,
        labels: body.labels ?? [],
        parentId: body.parentId ?? null,
      })
      .returning()
  )

  return c.json(task, 201)
})

// Get task
taskRoutes.get('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  const task = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.tasks.findFirst({
      where: and(eq(tasks.id, c.req.param('id')), eq(tasks.workspaceId, workspaceId)),
    })
  )

  if (!task) return c.json({ error: 'Not found' }, 404)
  return c.json(task)
})

// Update task
taskRoutes.patch('/:id', zValidator('json', taskSchema.partial()), async (c) => {
  const workspaceId = c.get('workspaceId')
  const body = c.req.valid('json')
  const { db } = getContainer()

  const [updated] = await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .update(tasks)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(tasks.id, c.req.param('id')), eq(tasks.workspaceId, workspaceId)))
      .returning()
  )

  if (!updated) return c.json({ error: 'Not found' }, 404)
  return c.json(updated)
})

// Delete task
taskRoutes.delete('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .delete(tasks)
      .where(and(eq(tasks.id, c.req.param('id')), eq(tasks.workspaceId, workspaceId)))
  )

  return c.json({ ok: true })
})
