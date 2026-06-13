import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { gcalConnections } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'

export const gcalRoutes = new Hono()

gcalRoutes.use('*', authMiddleware)
gcalRoutes.use('*', workspaceMiddleware)

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Failed to get access token')
  }
  return data.access_token
}

async function gcalGet(accessToken: string, path: string) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `Google Calendar API ${res.status}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

// List connections
gcalRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const rows = await db.query.gcalConnections.findMany({
    where: eq(gcalConnections.workspaceId, workspaceId),
    columns: { clientSecret: false, refreshToken: false },
  })
  return c.json(rows)
})

// Connect via OAuth credentials + refresh token
gcalRoutes.post(
  '/',
  zValidator(
    'json',
    z.object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      refreshToken: z.string().min(1),
    })
  ),
  async (c) => {
    const workspaceId = c.get('workspaceId')
    const user = c.get('user')
    const { clientId, clientSecret, refreshToken } = c.req.valid('json')
    const { db } = getContainer()

    let googleEmail: string
    try {
      const accessToken = await getAccessToken(clientId, clientSecret, refreshToken)
      const info = await gcalGet(accessToken, '/users/me/calendarList?maxResults=1') as {
        items?: { id?: string }[]
      }
      // Get user email from tokeninfo
      const tokenInfo = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
      ).then((r) => r.json()) as { email?: string }
      googleEmail = tokenInfo.email ?? info.items?.[0]?.id ?? 'unknown'
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Invalid credentials' }, 400)
    }

    // Upsert — one connection per Google account per workspace
    await db
      .delete(gcalConnections)
      .where(
        and(
          eq(gcalConnections.workspaceId, workspaceId),
          eq(gcalConnections.googleEmail, googleEmail)
        )
      )

    const [conn] = await db
      .insert(gcalConnections)
      .values({ workspaceId, googleEmail, clientId, clientSecret, refreshToken, connectedBy: user.sub })
      .returning()

    const { clientSecret: _cs, refreshToken: _rt, ...safe } = conn
    return c.json(safe, 201)
  }
)

// Test connection
gcalRoutes.get('/:id/test', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  const conn = await db.query.gcalConnections.findFirst({
    where: and(
      eq(gcalConnections.id, c.req.param('id')),
      eq(gcalConnections.workspaceId, workspaceId)
    ),
  })
  if (!conn) return c.json({ error: 'Not found' }, 404)

  try {
    const accessToken = await getAccessToken(conn.clientId, conn.clientSecret, conn.refreshToken)
    const data = await gcalGet(accessToken, '/users/me/calendarList?maxResults=5') as {
      items?: { summary?: string }[]
    }
    return c.json({
      ok: true,
      email: conn.googleEmail,
      calendars: data.items?.map((c) => c.summary) ?? [],
    })
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : 'Test failed' })
  }
})

// Disconnect
gcalRoutes.delete('/:id', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()
  await db
    .delete(gcalConnections)
    .where(
      and(
        eq(gcalConnections.id, c.req.param('id')),
        eq(gcalConnections.workspaceId, workspaceId)
      )
    )
  return c.json({ ok: true })
})
