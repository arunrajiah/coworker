import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { notionConnections } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'

export const notionRoutes = new Hono()

notionRoutes.use('*', authMiddleware)
notionRoutes.use('*', workspaceMiddleware)

async function notionGet(token: string, path: string) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
    },
  })
  if (!res.ok) throw new Error(`Notion API ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

async function notionPost(token: string, path: string, body: unknown) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `Notion API ${res.status}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

// List connections
notionRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const rows = await db.query.notionConnections.findMany({
    where: eq(notionConnections.workspaceId, workspaceId),
    columns: { accessToken: false },
  })
  return c.json(rows)
})

// Connect via internal integration token
notionRoutes.post(
  '/',
  zValidator('json', z.object({ token: z.string().min(1) })),
  async (c) => {
    const workspaceId = c.get('workspaceId')
    const user = c.get('user')
    const { token } = c.req.valid('json')
    const { db } = getContainer()

    let notionWorkspaceId: string
    let notionWorkspaceName: string
    let botId: string
    try {
      const data = await notionGet(token, '/users/me')
      const bot = data as {
        id: string
        bot?: { workspace_id?: string; workspace_name?: string }
        name?: string
      }
      botId = bot.id
      notionWorkspaceId = bot.bot?.workspace_id ?? 'unknown'
      notionWorkspaceName = bot.bot?.workspace_name ?? 'Notion Workspace'
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Invalid Notion token' }, 400)
    }

    // Upsert — one connection per Notion workspace per coworker workspace
    await db
      .delete(notionConnections)
      .where(
        and(
          eq(notionConnections.workspaceId, workspaceId),
          eq(notionConnections.notionWorkspaceId, notionWorkspaceId)
        )
      )

    const [conn] = await db
      .insert(notionConnections)
      .values({
        workspaceId,
        notionWorkspaceId,
        notionWorkspaceName,
        accessToken: token,
        botId,
        connectedBy: user.sub,
      })
      .returning()

    const { accessToken: _hidden, ...safe } = conn
    return c.json(safe, 201)
  }
)

// Test connection
notionRoutes.get('/:id/test', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const conn = await db.query.notionConnections.findFirst({
    where: and(
      eq(notionConnections.id, c.req.param('id')),
      eq(notionConnections.workspaceId, workspaceId)
    ),
  })
  if (!conn) return c.json({ error: 'Not found' }, 404)

  try {
    const data = await notionGet(conn.accessToken, '/users/me') as { name?: string }
    return c.json({ ok: true, workspaceName: conn.notionWorkspaceName, botName: data.name })
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : 'Test failed' })
  }
})

// Disconnect
notionRoutes.delete('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  await db
    .delete(notionConnections)
    .where(
      and(
        eq(notionConnections.id, c.req.param('id')),
        eq(notionConnections.workspaceId, workspaceId)
      )
    )
  return c.json({ ok: true })
})
