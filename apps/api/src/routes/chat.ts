import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, asc, desc } from 'drizzle-orm'
import { messages, agentRuns } from '@coworker/db'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'
import { withWorkspace } from '@coworker/db'
import { Queue } from 'bullmq'
import { nanoid } from 'nanoid'

export const chatRoutes = new Hono()

chatRoutes.use('*', authMiddleware)
chatRoutes.use('*', workspaceMiddleware)

let agentQueue: Queue | null = null
function getAgentQueue() {
  if (!agentQueue) {
    const { redis } = getContainer()
    agentQueue = new Queue('agent-runs', { connection: redis })
  }
  return agentQueue
}

// List threads
chatRoutes.get('/threads', async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  // Get distinct thread IDs with latest message
  const result = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.messages.findMany({
      where: eq(messages.workspaceId, workspaceId),
      orderBy: [desc(messages.createdAt)],
    })
  )

  // Group by threadId
  const threads = new Map<string, (typeof result)[0]>()
  for (const msg of result) {
    if (!threads.has(msg.threadId)) threads.set(msg.threadId, msg)
  }

  return c.json(Array.from(threads.values()))
})

// Get messages in thread
chatRoutes.get('/threads/:threadId/messages', async (c) => {
  const workspaceId = c.get('workspaceId')
  const threadId = c.req.param('threadId')
  const { db } = getContainer()

  const result = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.messages.findMany({
      where: and(eq(messages.workspaceId, workspaceId), eq(messages.threadId, threadId)),
      orderBy: [asc(messages.createdAt)],
    })
  )

  return c.json(result)
})

// Send a message (enqueues agent run)
chatRoutes.post(
  '/threads/:threadId/messages',
  zValidator(
    'json',
    z.object({
      content: z.string().min(1).max(32000),
      fileIds: z.array(z.string().uuid()).max(10).optional(),
    })
  ),
  async (c) => {
    const workspaceId = c.get('workspaceId')
    const user = c.get('user')
    const { content, fileIds } = c.req.valid('json')
    const threadId = c.req.param('threadId') === 'new' ? nanoid() : c.req.param('threadId')
    const { db } = getContainer()

    // Save user message
    const [userMessage] = await withWorkspace(db, workspaceId, async (tx) =>
      tx
        .insert(messages)
        .values({
          workspaceId,
          role: 'user',
          content,
          threadId,
          channel: 'web',
          userId: user.sub,
          metadata: fileIds && fileIds.length > 0 ? { fileIds } : undefined,
        })
        .returning()
    )

    // Create agent run record
    const [run] = await withWorkspace(db, workspaceId, async (tx) =>
      tx
        .insert(agentRuns)
        .values({ workspaceId, trigger: 'user_message', input: content })
        .returning()
    )

    // Enqueue agent job
    await getAgentQueue().add(
      'run',
      {
        workspaceId,
        threadId,
        messageId: userMessage.id,
        agentRunId: run.id,
        userId: user.sub,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      }
    )

    return c.json({ message: userMessage, agentRunId: run.id, threadId }, 201)
  }
)
