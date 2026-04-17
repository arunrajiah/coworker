import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { gitConnections, tasks } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
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
  const workspaceId = conn.workspaceId

  // Sync issue events to the kanban board
  if (event.type === 'issues') {
    const payload = event.payload as Record<string, unknown>
    const action = (payload.action as string) ?? event.action ?? ''
    const issueData = (payload.issue ?? payload.object_attributes ?? payload) as Record<string, unknown>

    const issueNumber = (issueData.number ?? issueData.iid ?? issueData.id) as number | undefined
    const issueTitle = issueData.title as string | undefined
    const issueBody = (issueData.body ?? issueData.description ?? null) as string | null
    const issueState = (issueData.state as string) ?? 'open'
    const issueLabels = Array.isArray(issueData.labels)
      ? (issueData.labels as any[]).map((l) => (typeof l === 'string' ? l : l?.name ?? '')).filter(Boolean)
      : []
    const issueUrl = (issueData.html_url ?? issueData.web_url ?? '') as string

    if (issueNumber && issueTitle) {
      const isClosed = issueState === 'closed' || issueState === 'resolved'
      const taskStatus = isClosed ? 'done' : 'backlog'

      const existing = await db.query.tasks.findFirst({
        where: and(
          eq(tasks.workspaceId, workspaceId),
          eq(tasks.gitConnectionId, connectionId),
          eq(tasks.gitIssueNumber, issueNumber)
        ),
      })

      if (existing) {
        const [updated] = await withWorkspace(db, workspaceId, async (tx) =>
          tx.update(tasks).set({
            title: issueTitle,
            description: issueBody,
            status: taskStatus,
            labels: issueLabels,
            updatedAt: new Date(),
          }).where(eq(tasks.id, existing.id)).returning()
        )
        await redis.publish(`ws:${workspaceId}`, JSON.stringify({ type: 'task:updated', task: updated }))
      } else if (action === 'opened' || action === 'created' || action === 'open') {
        const [task] = await withWorkspace(db, workspaceId, async (tx) =>
          tx.insert(tasks).values({
            workspaceId,
            title: issueTitle,
            description: issueBody,
            status: 'backlog',
            domain: 'development',
            labels: issueLabels,
            gitConnectionId: connectionId,
            gitIssueNumber: issueNumber,
            createdBy: conn.connectedBy,
            metadata: { issueUrl, provider: conn.provider },
          }).returning()
        )
        await redis.publish(`ws:${workspaceId}`, JSON.stringify({ type: 'task:created', task }))
      }
    }
  }

  // Broadcast the raw git event to WebSocket clients
  await redis.publish(
    `ws:${workspaceId}`,
    JSON.stringify({
      type: 'git:event',
      connectionId,
      workspaceId,
      provider: conn.provider,
      repo: `${conn.repoOwner}/${conn.repoName}`,
      event,
    })
  )

  // Publish to dedicated git channel so the worker can trigger autopilot rules
  await redis.publish(
    'git:events',
    JSON.stringify({
      type: event.type,
      action: event.action,
      connectionId,
      workspaceId,
      provider: conn.provider,
      repo: `${conn.repoOwner}/${conn.repoName}`,
      payload: event.payload,
    })
  )

  return c.json({ ok: true })
})
