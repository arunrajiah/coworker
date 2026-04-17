import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { autopilotRules } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'

export const autopilotRoutes = new Hono()

autopilotRoutes.use('*', authMiddleware)
autopilotRoutes.use('*', workspaceMiddleware)

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  triggerType: z.enum(['schedule', 'task_created', 'task_status_changed', 'message_received', 'git_issue_opened', 'git_pr_opened']),
  triggerConfig: z.record(z.unknown()).default({}),
  actionType: z.enum(['run_agent', 'create_task', 'send_message', 'call_webhook']),
  actionConfig: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
})

autopilotRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  const rules = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.autopilotRules.findMany({
      where: eq(autopilotRules.workspaceId, workspaceId),
    })
  )

  return c.json(rules)
})

autopilotRoutes.post('/', zValidator('json', ruleSchema), async (c) => {
  const workspaceId = c.get('workspaceId')
  const user = c.get('user')
  const body = c.req.valid('json')
  const { db } = getContainer()

  const [rule] = await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .insert(autopilotRules)
      .values({ workspaceId, createdBy: user.sub, ...body })
      .returning()
  )

  // Signal worker to resync schedules via Redis pub/sub
  const { redis } = getContainer()
  await redis.publish('autopilot:sync', JSON.stringify({ workspaceId }))

  return c.json(rule, 201)
})

autopilotRoutes.patch('/:id', zValidator('json', ruleSchema.partial()), async (c) => {
  const workspaceId = c.get('workspaceId')
  const body = c.req.valid('json')
  const { db, redis } = getContainer()

  const [updated] = await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .update(autopilotRules)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(autopilotRules.id, c.req.param('id')), eq(autopilotRules.workspaceId, workspaceId)))
      .returning()
  )

  if (!updated) return c.json({ error: 'Not found' }, 404)

  await redis.publish('autopilot:sync', JSON.stringify({ workspaceId }))

  return c.json(updated)
})

autopilotRoutes.delete('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db, redis } = getContainer()

  await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .delete(autopilotRules)
      .where(and(eq(autopilotRules.id, c.req.param('id')), eq(autopilotRules.workspaceId, workspaceId)))
  )

  await redis.publish('autopilot:sync', JSON.stringify({ workspaceId }))

  return c.json({ ok: true })
})

autopilotRoutes.post('/:id/run', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db, redis } = getContainer()

  const rule = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.autopilotRules.findFirst({
      where: and(eq(autopilotRules.id, c.req.param('id')), eq(autopilotRules.workspaceId, workspaceId)),
    })
  )
  if (!rule) return c.json({ error: 'Not found' }, 404)

  await redis.publish(
    'autopilot:run',
    JSON.stringify({
      ruleId: rule.id,
      workspaceId: rule.workspaceId,
      actionType: rule.actionType,
      actionConfig: rule.actionConfig,
    })
  )

  return c.json({ ok: true })
})
