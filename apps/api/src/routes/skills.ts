import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { skills } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'
import { withWorkspace } from '@coworker/db'

export const skillRoutes = new Hono()

skillRoutes.use('*', authMiddleware)
skillRoutes.use('*', workspaceMiddleware)

const skillSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  prompt: z.string().min(1).max(10000),
  triggerPhrase: z.string().max(50).optional(),
  tools: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
})

skillRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const result = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.skills.findMany({ where: eq(skills.workspaceId, workspaceId) })
  )
  return c.json(result)
})

skillRoutes.post('/', zValidator('json', skillSchema), async (c) => {
  const workspaceId = c.get('workspaceId')
  const user = c.get('user')
  const body = c.req.valid('json')
  const { db } = getContainer()

  const [skill] = await withWorkspace(db, workspaceId, async (tx) =>
    tx.insert(skills).values({ workspaceId, createdBy: user.sub, ...body }).returning()
  )
  return c.json(skill, 201)
})

skillRoutes.patch('/:id', zValidator('json', skillSchema.partial()), async (c) => {
  const workspaceId = c.get('workspaceId')
  const body = c.req.valid('json')
  const { db } = getContainer()

  const [updated] = await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .update(skills)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(skills.id, c.req.param('id')), eq(skills.workspaceId, workspaceId)))
      .returning()
  )
  if (!updated) return c.json({ error: 'Not found' }, 404)
  return c.json(updated)
})

skillRoutes.delete('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  await withWorkspace(db, workspaceId, async (tx) =>
    tx.delete(skills).where(and(eq(skills.id, c.req.param('id')), eq(skills.workspaceId, workspaceId)))
  )
  return c.json({ ok: true })
})
