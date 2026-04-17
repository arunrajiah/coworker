import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { workspaces, workspaceMembers, skills, autopilotRules } from '@coworker/db'
import { FOUNDER_TEMPLATES } from '@coworker/core'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import slugify from 'slug'

export const workspaceRoutes = new Hono()

workspaceRoutes.use('*', authMiddleware)

// List my workspaces
workspaceRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { db } = getContainer()

  const memberships = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.userId, user.sub),
    with: { workspace: true },
  })

  return c.json(memberships.map((m) => ({ ...(m.workspace as object), role: m.role })))
})

// Create workspace
workspaceRoutes.post(
  '/',
  zValidator(
    'json',
    z.object({
      name: z.string().min(2).max(64),
      templateType: z
        .enum(['saas', 'agency', 'ecommerce', 'consulting', 'freelancer', 'general'])
        .default('general'),
    })
  ),
  async (c) => {
    const user = c.get('user')
    const { name, templateType } = c.req.valid('json')
    const { db } = getContainer()

    const baseSlug = slugify(name)
    let slug = baseSlug
    let attempt = 0
    while (await db.query.workspaces.findFirst({ where: eq(workspaces.slug, slug) })) {
      slug = `${baseSlug}-${++attempt}`
    }

    const [workspace] = await db
      .insert(workspaces)
      .values({ name, slug, ownerId: user.sub, templateType })
      .returning()

    // Add owner as member
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.sub,
      role: 'owner',
      joinedAt: new Date(),
    })

    // Seed template defaults
    const template = FOUNDER_TEMPLATES[templateType]
    if (template.defaultSkills.length > 0) {
      await db.insert(skills).values(
        template.defaultSkills.map((s) => ({
          workspaceId: workspace.id,
          createdBy: user.sub,
          name: s.name,
          description: s.description,
          prompt: s.prompt,
          triggerPhrase: s.triggerPhrase ?? null,
          tools: s.tools,
        }))
      )
    }
    if (template.defaultAutopilotRules.length > 0) {
      await db.insert(autopilotRules).values(
        template.defaultAutopilotRules.map((r) => ({
          workspaceId: workspace.id,
          createdBy: user.sub,
          name: r.name,
          description: r.description ?? null,
          triggerType: r.triggerType,
          triggerConfig: r.triggerConfig,
          actionType: r.actionType,
          actionConfig: r.actionConfig,
        }))
      )
    }

    return c.json({ ...workspace, role: 'owner' }, 201)
  }
)

// Get workspace
workspaceRoutes.get('/:slug', async (c) => {
  const { db } = getContainer()
  const slug = c.req.param('slug')
  const user = c.get('user')

  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.slug, slug) })
  if (!ws) return c.json({ error: 'Not found' }, 404)

  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.workspaceId, ws.id),
  })
  if (!membership || membership.userId !== user.sub) return c.json({ error: 'Forbidden' }, 403)

  return c.json({ ...ws, role: membership.role })
})
