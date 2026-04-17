import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { vercelConnections } from '@coworker/db'
import { VercelAdapter } from '@coworker/adapter-vercel'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'

export const vercelRoutes = new Hono()

vercelRoutes.use('*', authMiddleware)
vercelRoutes.use('*', workspaceMiddleware)

// List Vercel connections for this workspace
vercelRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  const connections = await db.query.vercelConnections.findMany({
    where: eq(vercelConnections.workspaceId, workspaceId),
    columns: { accessToken: false },
  })

  return c.json(connections)
})

// List projects for a token (before connecting)
vercelRoutes.post(
  '/projects',
  zValidator('json', z.object({
    accessToken: z.string().min(1),
    teamId: z.string().optional(),
  })),
  async (c) => {
    const { accessToken, teamId } = c.req.valid('json')
    try {
      const adapter = new VercelAdapter(accessToken, teamId)
      const [user, teams, projects] = await Promise.all([
        adapter.getUser(),
        adapter.getTeams(),
        adapter.getProjects(),
      ])
      return c.json({ user, teams, projects })
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Invalid token' }, 400)
    }
  }
)

// Connect a Vercel project
vercelRoutes.post(
  '/',
  zValidator('json', z.object({
    accessToken: z.string().min(1),
    teamId: z.string().optional(),
    teamSlug: z.string().optional(),
    teamName: z.string().optional(),
    projectId: z.string().min(1),
    projectName: z.string().min(1),
    framework: z.string().optional(),
    gitConnectionId: z.string().uuid().optional(),
  })),
  async (c) => {
    const user = c.get('user')
    const workspaceId = c.get('workspaceId')
    const { accessToken, teamId, teamSlug, teamName, projectId, projectName, framework, gitConnectionId } = c.req.valid('json')
    const { db } = getContainer()

    // Validate token + project access
    try {
      const adapter = new VercelAdapter(accessToken, teamId)
      await adapter.getProject(projectId)
    } catch (err) {
      return c.json({ error: `Cannot access project: ${err instanceof Error ? err.message : 'check your token'}` }, 400)
    }

    const [connection] = await db
      .insert(vercelConnections)
      .values({
        workspaceId,
        accessToken,
        teamId: teamId ?? null,
        teamSlug: teamSlug ?? null,
        teamName: teamName ?? null,
        projectId,
        projectName,
        framework: framework ?? null,
        gitConnectionId: gitConnectionId ?? null,
        connectedBy: user.sub,
      })
      .returning()

    const { accessToken: _t, ...safe } = connection
    return c.json(safe, 201)
  }
)

// Update a Vercel connection (link/unlink git connection)
vercelRoutes.patch(
  '/:connectionId',
  zValidator('json', z.object({
    gitConnectionId: z.string().uuid().nullable().optional(),
  })),
  async (c) => {
    const workspaceId = c.get('workspaceId')
    const connectionId = c.req.param('connectionId')
    const { db } = getContainer()

    const conn = await db.query.vercelConnections.findFirst({
      where: and(eq(vercelConnections.id, connectionId), eq(vercelConnections.workspaceId, workspaceId)),
    })
    if (!conn) return c.json({ error: 'Not found' }, 404)

    const body = c.req.valid('json')
    const [updated] = await db
      .update(vercelConnections)
      .set({ ...(body.gitConnectionId !== undefined ? { gitConnectionId: body.gitConnectionId } : {}) })
      .where(eq(vercelConnections.id, connectionId))
      .returning()

    const { accessToken: _t, ...safe } = updated
    return c.json(safe)
  }
)

// Delete a Vercel connection
vercelRoutes.delete('/:connectionId', async (c) => {
  const workspaceId = c.get('workspaceId')
  const connectionId = c.req.param('connectionId')
  const { db } = getContainer()

  const conn = await db.query.vercelConnections.findFirst({
    where: and(eq(vercelConnections.id, connectionId), eq(vercelConnections.workspaceId, workspaceId)),
  })
  if (!conn) return c.json({ error: 'Not found' }, 404)

  await db.delete(vercelConnections).where(eq(vercelConnections.id, connectionId))
  return c.json({ ok: true })
})

// List deployments for a connected project
vercelRoutes.get('/:connectionId/deployments', async (c) => {
  const workspaceId = c.get('workspaceId')
  const connectionId = c.req.param('connectionId')
  const { db } = getContainer()

  const conn = await db.query.vercelConnections.findFirst({
    where: and(eq(vercelConnections.id, connectionId), eq(vercelConnections.workspaceId, workspaceId)),
  })
  if (!conn) return c.json({ error: 'Not found' }, 404)

  try {
    const adapter = new VercelAdapter(conn.accessToken, conn.teamId ?? undefined)
    const deployments = await adapter.listDeployments(conn.projectId)
    return c.json({ deployments })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 400)
  }
})

// Trigger a new deployment
vercelRoutes.post('/:connectionId/deploy', async (c) => {
  const workspaceId = c.get('workspaceId')
  const connectionId = c.req.param('connectionId')
  const { db } = getContainer()

  const conn = await db.query.vercelConnections.findFirst({
    where: and(eq(vercelConnections.id, connectionId), eq(vercelConnections.workspaceId, workspaceId)),
  })
  if (!conn) return c.json({ error: 'Not found' }, 404)

  try {
    const adapter = new VercelAdapter(conn.accessToken, conn.teamId ?? undefined)
    const deployment = await adapter.triggerDeployment(conn.projectId)
    return c.json({ deployment })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 400)
  }
})
