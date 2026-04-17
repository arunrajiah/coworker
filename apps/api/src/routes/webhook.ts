import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { gitConnections } from '@coworker/db'
import { createGitAdapter } from '@coworker/adapter-git'
import { getContainer } from '../container.js'

export const webhookRoutes = new Hono()

// POST /webhooks/git/:connectionId
webhookRoutes.post('/git/:connectionId', async (c) => {
  const connectionId = c.req.param('connectionId')
  const { db, redis } = getContainer()

  const conn = await db.query.gitConnections.findFirst({
    where: eq(gitConnections.id, connectionId),
  })
  if (!conn) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.text()
  const headers = Object.fromEntries(c.req.raw.headers.entries())

  const adapter = createGitAdapter(conn.provider, conn.accessToken)

  // Verify signature
  const sigHeaderMap: Record<string, string> = {
    github: 'x-hub-signature-256',
    gitlab: 'x-gitlab-token',
    bitbucket: 'x-hub-signature',
  }
  const sigHeader = sigHeaderMap[conn.provider]

  const signature = headers[sigHeader] ?? ''
  if (!adapter.verifyWebhook(body, signature, conn.webhookSecret)) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const event = adapter.parseWebhookEvent(headers, body)

  // Publish to Redis so the worker can react
  await redis.publish(
    `ws:${conn.workspaceId}`,
    JSON.stringify({
      type: 'git:event',
      connectionId,
      workspaceId: conn.workspaceId,
      provider: conn.provider,
      repo: `${conn.repoOwner}/${conn.repoName}`,
      event,
    })
  )

  return c.json({ ok: true })
})
