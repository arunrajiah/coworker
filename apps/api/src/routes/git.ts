import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { gitConnections } from '@coworker/db'
import { createGitAdapter } from '@coworker/adapter-git'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'
import { nanoid } from 'nanoid'

export const gitRoutes = new Hono()

gitRoutes.use('*', authMiddleware)
gitRoutes.use('*', workspaceMiddleware)

// List git connections for this workspace
gitRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  const connections = await db.query.gitConnections.findMany({
    where: eq(gitConnections.workspaceId, workspaceId),
    columns: { accessToken: false }, // never expose the token
  })

  return c.json(connections)
})

// Connect a git provider
gitRoutes.post(
  '/',
  zValidator(
    'json',
    z.object({
      provider: z.enum(['github', 'gitlab', 'bitbucket']),
      repoOwner: z.string().min(1),
      repoName: z.string().min(1),
      accessToken: z.string().min(1),
    })
  ),
  async (c) => {
    const user = c.get('user')
    const workspaceId = c.get('workspaceId')
    const { provider, repoOwner, repoName, accessToken } = c.req.valid('json')
    const { db } = getContainer()

    // Validate the token by fetching the repo
    const adapter = createGitAdapter(provider, accessToken)
    try {
      await adapter.getRepo(repoOwner, repoName)
    } catch (err) {
      return c.json({ error: `Could not access ${repoOwner}/${repoName}: ${err instanceof Error ? err.message : 'check your token'}` }, 400)
    }

    const webhookSecret = nanoid(32)

    const [connection] = await db
      .insert(gitConnections)
      .values({ workspaceId, provider, repoOwner, repoName, accessToken, webhookSecret, connectedBy: user.sub })
      .returning()

    // Return without the access token
    const { accessToken: _token, ...safe } = connection
    return c.json({ ...safe, webhookSecret }, 201)
  }
)

// Delete a git connection
gitRoutes.delete('/:connectionId', async (c) => {
  const workspaceId = c.get('workspaceId')
  const connectionId = c.req.param('connectionId')
  const { db } = getContainer()

  const conn = await db.query.gitConnections.findFirst({
    where: and(eq(gitConnections.id, connectionId), eq(gitConnections.workspaceId, workspaceId)),
  })
  if (!conn) return c.json({ error: 'Not found' }, 404)

  await db.delete(gitConnections).where(eq(gitConnections.id, connectionId))
  return c.json({ ok: true })
})

// Test a connection (verify token still works)
gitRoutes.get('/:connectionId/test', async (c) => {
  const workspaceId = c.get('workspaceId')
  const connectionId = c.req.param('connectionId')
  const { db } = getContainer()

  const conn = await db.query.gitConnections.findFirst({
    where: and(eq(gitConnections.id, connectionId), eq(gitConnections.workspaceId, workspaceId)),
  })
  if (!conn) return c.json({ error: 'Not found' }, 404)

  try {
    const adapter = createGitAdapter(conn.provider, conn.accessToken)
    const repo = await adapter.getRepo(conn.repoOwner, conn.repoName)
    return c.json({ ok: true, repo })
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : 'Connection failed' })
  }
})
