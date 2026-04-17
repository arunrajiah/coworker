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

const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'] as const
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
const DOMAINS = ['general', 'development', 'qa', 'marketing', 'finance', 'design', 'operations', 'hr', 'legal', 'sales'] as const

const taskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  domain: z.enum(DOMAINS).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  labels: z.array(z.string()).optional(),
  parentId: z.string().uuid().optional().nullable(),
  agentOwned: z.boolean().optional(),
  queuedForAgent: z.boolean().optional(),
  agentNotes: z.string().optional().nullable(),
})

// List tasks — supports ?status=&domain=&priority=
taskRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const { status, domain, priority } = c.req.query()

  const result = await withWorkspace(db, workspaceId, async (tx) => {
    const conditions = [eq(tasks.workspaceId, workspaceId)]
    if (status) conditions.push(eq(tasks.status, status as any))
    if (domain) conditions.push(eq(tasks.domain, domain as any))
    if (priority) conditions.push(eq(tasks.priority, priority as any))

    return tx.query.tasks.findMany({
      where: and(...conditions),
      orderBy: [asc(tasks.status), desc(tasks.priority), desc(tasks.createdAt)],
    })
  })

  return c.json(result)
})

// Board view — tasks grouped by status for kanban
taskRoutes.get('/board', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const { domain } = c.req.query()

  const conditions = [eq(tasks.workspaceId, workspaceId)]
  if (domain && domain !== 'all') conditions.push(eq(tasks.domain, domain as any))

  const allTasks = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.tasks.findMany({
      where: and(...conditions),
      orderBy: [desc(tasks.priority), desc(tasks.createdAt)],
    })
  )

  const columns: Record<string, typeof allTasks> = {
    backlog: [],
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  }

  for (const task of allTasks) {
    if (task.status !== 'cancelled' && columns[task.status]) {
      columns[task.status].push(task)
    }
  }

  return c.json(columns)
})

// Create task
taskRoutes.post('/', zValidator('json', taskSchema), async (c) => {
  const workspaceId = c.get('workspaceId')
  const user = c.get('user')
  const body = c.req.valid('json')
  const { db, redis } = getContainer()

  const [task] = await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .insert(tasks)
      .values({
        workspaceId,
        createdBy: user.sub,
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? 'todo',
        priority: body.priority ?? 'medium',
        domain: body.domain ?? 'general',
        assigneeId: body.assigneeId ?? null,
        dueDate: body.dueDate ?? null,
        labels: body.labels ?? [],
        parentId: body.parentId ?? null,
        agentOwned: body.agentOwned ?? false,
        queuedForAgent: body.queuedForAgent ?? false,
        agentNotes: body.agentNotes ?? null,
      })
      .returning()
  )

  await redis.publish(`ws:${workspaceId}`, JSON.stringify({ type: 'task:created', task }))

  return c.json(task, 201)
})

// Batch create tasks (for AI orchestration)
taskRoutes.post(
  '/batch',
  zValidator('json', z.object({ tasks: z.array(taskSchema).min(1).max(50) })),
  async (c) => {
    const workspaceId = c.get('workspaceId')
    const user = c.get('user')
    const { tasks: taskList } = c.req.valid('json')
    const { db, redis } = getContainer()

    const created = await withWorkspace(db, workspaceId, async (tx) =>
      tx
        .insert(tasks)
        .values(
          taskList.map((body) => ({
            workspaceId,
            createdBy: user.sub,
            title: body.title,
            description: body.description ?? null,
            status: body.status ?? 'todo',
            priority: body.priority ?? 'medium',
            domain: body.domain ?? 'general',
            assigneeId: body.assigneeId ?? null,
            dueDate: body.dueDate ?? null,
            labels: body.labels ?? [],
            parentId: body.parentId ?? null,
            agentOwned: body.agentOwned ?? false,
            queuedForAgent: body.queuedForAgent ?? false,
            agentNotes: body.agentNotes ?? null,
          }))
        )
        .returning()
    )

    for (const task of created) {
      await redis.publish(`ws:${workspaceId}`, JSON.stringify({ type: 'task:created', task }))
    }

    return c.json({ tasks: created }, 201)
  }
)

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
  const { db, redis } = getContainer()

  const [updated] = await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .update(tasks)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(tasks.id, c.req.param('id')), eq(tasks.workspaceId, workspaceId)))
      .returning()
  )

  if (!updated) return c.json({ error: 'Not found' }, 404)

  await redis.publish(`ws:${workspaceId}`, JSON.stringify({ type: 'task:updated', task: updated }))

  return c.json(updated)
})

// Delete task
taskRoutes.delete('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db, redis } = getContainer()

  await withWorkspace(db, workspaceId, async (tx) =>
    tx.delete(tasks).where(and(eq(tasks.id, c.req.param('id')), eq(tasks.workspaceId, workspaceId)))
  )

  await redis.publish(`ws:${workspaceId}`, JSON.stringify({ type: 'task:deleted', taskId: c.req.param('id') }))

  return c.json({ ok: true })
})
