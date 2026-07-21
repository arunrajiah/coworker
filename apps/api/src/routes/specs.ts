import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { specs } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'
import { withWorkspace } from '@coworker/db'

export const specRoutes = new Hono()

specRoutes.use('*', authMiddleware)
specRoutes.use('*', workspaceMiddleware)

const TYPES = ['requirement', 'blueprint', 'feedback'] as const
const STATUSES = ['draft', 'active', 'deprecated'] as const

const specSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(200000).optional(),
  type: z.enum(TYPES).optional(),
  status: z.enum(STATUSES).optional(),
})

specRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const { type } = c.req.query()

  const result = await withWorkspace(db, workspaceId, async (tx) => {
    const conditions = [eq(specs.workspaceId, workspaceId)]
    if (type) conditions.push(eq(specs.type, type as any))

    return tx.query.specs.findMany({
      where: and(...conditions),
      orderBy: [desc(specs.updatedAt)],
    })
  })

  return c.json({ specs: result })
})

specRoutes.get('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  const spec = await withWorkspace(db, workspaceId, async (tx) => {
    return tx.query.specs.findFirst({
      where: and(eq(specs.id, c.req.param('id')), eq(specs.workspaceId, workspaceId)),
    })
  })

  if (!spec) return c.json({ error: 'Not found' }, 404)
  return c.json(spec)
})

specRoutes.post('/', zValidator('json', specSchema), async (c) => {
  const workspaceId = c.get('workspaceId')
  const user = c.get('user')
  const { db } = getContainer()
  const body = c.req.valid('json')

  const [spec] = await withWorkspace(db, workspaceId, async (tx) => {
    return tx
      .insert(specs)
      .values({
        workspaceId,
        title: body.title,
        content: body.content ?? '',
        type: body.type ?? 'requirement',
        status: body.status ?? 'draft',
        createdBy: user.sub,
      })
      .returning()
  })

  return c.json(spec, 201)
})

specRoutes.patch('/:id', zValidator('json', specSchema.partial()), async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const body = c.req.valid('json')

  const [spec] = await withWorkspace(db, workspaceId, async (tx) => {
    return tx
      .update(specs)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(specs.id, c.req.param('id')), eq(specs.workspaceId, workspaceId)))
      .returning()
  })

  if (!spec) return c.json({ error: 'Not found' }, 404)
  return c.json(spec)
})

specRoutes.delete('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  await withWorkspace(db, workspaceId, async (tx) => {
    return tx
      .delete(specs)
      .where(and(eq(specs.id, c.req.param('id')), eq(specs.workspaceId, workspaceId)))
  })

  return c.json({ ok: true })
})
