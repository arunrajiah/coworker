import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { telegramConnections, slackConnections, files, memories } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'

export const integrationRoutes = new Hono()

integrationRoutes.use('*', authMiddleware)
integrationRoutes.use('*', workspaceMiddleware)

// ── Telegram ──────────────────────────────────────────────────────────────────

// Generate a one-time connect code for the Telegram bot
integrationRoutes.post('/telegram/connect-code', async (c) => {
  const user = c.get('user')
  const workspaceId = c.get('workspaceId')
  const { redis } = getContainer()

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return c.json({ error: 'Telegram bot is not configured on this server' }, 503)
  }

  // Get bot username for the connect instructions
  let botUsername = 'your_coworker_bot'
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const data = (await res.json()) as { result?: { username?: string } }
    botUsername = data.result?.username ?? botUsername
  } catch {
    // Non-fatal — instructions still work without the exact bot name
  }

  const { nanoid } = await import('nanoid')
  const code = nanoid(12)
  await redis.set(`tg:connect:${code}`, `${workspaceId}:${user.sub}`, 'EX', 600)
  // Note: worker reads this same key prefix when /connect <code> is sent to the bot

  return c.json({ code, botUsername, expiresInSeconds: 600 })
})

// Get current Telegram connection status for this workspace
integrationRoutes.get('/telegram', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  const connections = await db.query.telegramConnections.findMany({
    where: eq(telegramConnections.workspaceId, workspaceId),
    columns: { id: true, telegramUsername: true, connectedAt: true },
  })

  return c.json({ connections })
})

// Disconnect a Telegram chat from this workspace
integrationRoutes.delete('/telegram/:connectionId', async (c) => {
  const workspaceId = c.get('workspaceId')
  const connectionId = c.req.param('connectionId')
  const { db } = getContainer()

  const connection = await db.query.telegramConnections.findFirst({
    where: eq(telegramConnections.id, connectionId),
  })

  if (!connection || connection.workspaceId !== workspaceId) {
    return c.json({ error: 'Not found' }, 404)
  }

  await db.delete(telegramConnections).where(eq(telegramConnections.id, connectionId))

  return c.json({ ok: true })
})

// ── Files ─────────────────────────────────────────────────────────────────────

// Upload a file
integrationRoutes.post('/files', async (c) => {
  const user = c.get('user')
  const workspaceId = c.get('workspaceId')
  const { db, storage } = getContainer()

  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400)
  }

  const MAX_SIZE = 25 * 1024 * 1024 // 25 MB
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large (max 25 MB)' }, 413)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() ?? 'bin'
  const { nanoid } = await import('nanoid')
  const key = `workspaces/${workspaceId}/files/${nanoid()}.${ext}`

  const { url } = await storage.upload(key, buffer, file.type)

  const { fileIngestionQueue } = getContainer()

  const [record] = await withWorkspace(db, workspaceId, async (tx) =>
    tx
      .insert(files)
      .values({
        workspaceId,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storageKey: key,
        storageBackend: 'local',
        uploadedBy: user.sub,
      })
      .returning()
  )

  await fileIngestionQueue.add('ingest', { workspaceId, fileId: record.id })

  return c.json({ ...record, url }, 201)
})

// List files in a workspace
integrationRoutes.get('/files', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db, storage } = getContainer()

  const fileList = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.files.findMany({
      where: eq(files.workspaceId, workspaceId),
      orderBy: (f, { desc }) => [desc(f.createdAt)],
      limit: 100,
    })
  )

  return c.json(
    fileList.map((f) => ({
      ...f,
      url: storage.getUrl(f.storageKey),
    }))
  )
})

// Delete a file
integrationRoutes.delete('/files/:fileId', async (c) => {
  const workspaceId = c.get('workspaceId')
  const fileId = c.req.param('fileId')
  const { db, storage } = getContainer()

  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) })
  if (!file || file.workspaceId !== workspaceId) {
    return c.json({ error: 'Not found' }, 404)
  }

  await storage.delete(file.storageKey)
  await db.delete(files).where(eq(files.id, fileId))

  return c.json({ ok: true })
})

// Get extracted text chunks for a file
integrationRoutes.get('/files/:fileId/extracted-text', async (c) => {
  const workspaceId = c.get('workspaceId')
  const fileId = c.req.param('fileId')
  const { db } = getContainer()

  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) })
  if (!file || file.workspaceId !== workspaceId) {
    return c.json({ error: 'Not found' }, 404)
  }

  const chunks = await db.execute(
    sql`SELECT content, metadata FROM tenant.memories WHERE workspace_id = ${workspaceId}::uuid AND source_type = 'file' AND source_id = ${fileId}::uuid ORDER BY (metadata->>'chunkIndex')::int NULLS LAST`
  )

  return c.json({
    fileId,
    extractionStatus: file.extractionStatus,
    extractedAt: file.extractedAt,
    chunks: (chunks as any[]).map((r: any) => ({ content: r.content as string, metadata: r.metadata })),
  })
})

// ── Slack ─────────────────────────────────────────────────────────────────────

// GET /slack — connection status for this workspace
integrationRoutes.get('/slack', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  const connection = await db.query.slackConnections.findFirst({
    where: eq(slackConnections.workspaceId, workspaceId),
  })

  if (!connection) return c.json(null)

  return c.json({
    connected: true,
    teamName: connection.teamName,
    teamId: connection.teamId,
    connectedAt: connection.connectedAt,
  })
})

// POST /slack/connect — save a bot token and connect
integrationRoutes.post('/slack/connect', async (c) => {
  const workspaceId = c.get('workspaceId')
  const user = c.get('user')
  const { db } = getContainer()
  const { botToken, appToken } = await c.req.json<{ botToken: string; appToken?: string }>()

  if (!botToken?.startsWith('xoxb-')) {
    return c.json({ error: 'Invalid bot token — must start with xoxb-' }, 400)
  }

  // Validate token and fetch workspace info via Slack API
  let teamName: string | undefined
  let teamId: string | undefined
  let botUserId: string | undefined
  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${botToken}` },
    })
    const data = await res.json() as { ok: boolean; team?: string; team_id?: string; user_id?: string; error?: string }
    if (!data.ok) return c.json({ error: `Slack API error: ${data.error}` }, 400)
    teamName = data.team
    teamId = data.team_id
    botUserId = data.user_id
  } catch {
    return c.json({ error: 'Could not reach Slack API' }, 502)
  }

  // Upsert connection
  const existing = await db.query.slackConnections.findFirst({
    where: eq(slackConnections.workspaceId, workspaceId),
  })

  if (existing) {
    await db
      .update(slackConnections)
      .set({ botToken, appToken: appToken ?? null, teamName: teamName ?? null, teamId: teamId ?? null, botUserId: botUserId ?? null })
      .where(eq(slackConnections.workspaceId, workspaceId))
  } else {
    await db.insert(slackConnections).values({
      workspaceId,
      userId: user.sub,
      botToken,
      appToken: appToken ?? null,
      teamName: teamName ?? null,
      teamId: teamId ?? null,
      botUserId: botUserId ?? null,
    })
  }

  return c.json({ connected: true, teamName, teamId })
})

// DELETE /slack/disconnect
integrationRoutes.delete('/slack/disconnect', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  await db.delete(slackConnections).where(eq(slackConnections.workspaceId, workspaceId))

  return c.json({ ok: true })
})
