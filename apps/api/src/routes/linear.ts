import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { linearConnections } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'

export const linearRoutes = new Hono()

linearRoutes.use('*', authMiddleware)
linearRoutes.use('*', workspaceMiddleware)

async function fetchLinear(apiKey: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Linear API error: ${res.status}`)
  const json = await res.json() as { data?: unknown; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data
}

// List connections (never return apiKey)
linearRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const rows = await db.query.linearConnections.findMany({
    where: eq(linearConnections.workspaceId, workspaceId),
    columns: { apiKey: false },
  })
  return c.json(rows)
})

// Connect a Linear workspace
linearRoutes.post(
  '/',
  zValidator('json', z.object({ apiKey: z.string().min(1) })),
  async (c) => {
    const workspaceId = c.get('workspaceId')
    const user = c.get('user')
    const { apiKey } = c.req.valid('json')
    const { db } = getContainer()

    // Validate key and fetch team info
    let teamId: string
    let teamName: string
    try {
      const data = await fetchLinear(apiKey, `{ viewer { organization { id name } } }`) as {
        viewer: { organization: { id: string; name: string } }
      }
      teamId = data.viewer.organization.id
      teamName = data.viewer.organization.name
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Invalid Linear API key' }, 400)
    }

    // Upsert — replace existing connection for same team
    await db
      .delete(linearConnections)
      .where(and(eq(linearConnections.workspaceId, workspaceId), eq(linearConnections.teamId, teamId)))

    const [conn] = await db
      .insert(linearConnections)
      .values({ workspaceId, teamId, teamName, apiKey, connectedBy: user.sub })
      .returning()

    const { apiKey: _hidden, ...safe } = conn
    return c.json(safe, 201)
  }
)

// Test an existing connection
linearRoutes.get('/:id/test', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const conn = await db.query.linearConnections.findFirst({
    where: and(eq(linearConnections.id, c.req.param('id')), eq(linearConnections.workspaceId, workspaceId)),
  })
  if (!conn) return c.json({ error: 'Not found' }, 404)

  try {
    const data = await fetchLinear(conn.apiKey, `{ viewer { name email } }`) as {
      viewer: { name: string; email: string }
    }
    return c.json({ ok: true, viewer: data.viewer, teamName: conn.teamName })
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : 'Test failed' })
  }
})

// Disconnect
linearRoutes.delete('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  await db
    .delete(linearConnections)
    .where(and(eq(linearConnections.id, c.req.param('id')), eq(linearConnections.workspaceId, workspaceId)))
  return c.json({ ok: true })
})
