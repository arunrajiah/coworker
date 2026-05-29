import { App, LogLevel } from '@slack/bolt'
import { eq } from 'drizzle-orm'
import { slackConnections, workspaces, messages, agentRuns } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import type { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import { nanoid } from 'nanoid'
import type { AgentJobData } from '../agent/executor.js'

const PENDING_REPLY_PREFIX = 'slack:reply:'
const THREAD_PREFIX = 'slack:thread:'

/** Returns a stable Coworker thread ID for a Slack (team, channel) pair */
async function getOrCreateThreadId(redis: Redis, teamId: string, channelId: string): Promise<string> {
  const key = `${THREAD_PREFIX}${teamId}:${channelId}`
  let threadId = await redis.get(key)
  if (!threadId) {
    threadId = nanoid()
    await redis.set(key, threadId)
  }
  return threadId
}

export interface SlackBotInstance {
  stop: () => Promise<void>
  refreshConnections: () => Promise<void>
}

export async function startSlackBots(
  db: DbClient,
  redis: Redis,
  agentQueue: Queue<AgentJobData>
): Promise<SlackBotInstance> {
  // Map of workspaceId → Bolt App instance
  const apps = new Map<string, App>()

  // Subscribe to Redis for async agent replies
  const subscriber = redis.duplicate()
  subscriber.psubscribe('ws:*')

  subscriber.on('pmessage', async (_pattern, _channel, raw) => {
    try {
      const event = JSON.parse(raw) as Record<string, unknown>
      if (event.type !== 'agent:message') return

      const replyKey = `${PENDING_REPLY_PREFIX}${event.agentRunId}`
      const replyTarget = await redis.get(replyKey)
      if (!replyTarget) return
      await redis.del(replyKey)

      const { botToken, channelId, threadTs } = JSON.parse(replyTarget) as {
        botToken: string
        channelId: string
        threadTs?: string
      }

      const content = (event.message as { content?: string } | null)?.content
      if (!content) return

      const { WebClient } = await import('@slack/web-api')
      const client = new WebClient(botToken)
      await client.chat.postMessage({
        channel: channelId,
        text: content,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      })
    } catch {
      // Swallow errors
    }
  })

  async function launchApp(connection: typeof slackConnections.$inferSelect) {
    if (apps.has(connection.workspaceId)) return // already running

    try {
      const app = new App({
        token: connection.botToken,
        appToken: connection.appToken ?? undefined,
        socketMode: !!connection.appToken,
        logLevel: LogLevel.WARN,
        // When not using socket mode, Bolt needs a receiver — skip for now (socket mode only)
      })

      // Handle direct messages and @mentions
      app.message(async ({ message, say }) => {
        const msg = message as {
          text?: string
          channel: string
          ts: string
          thread_ts?: string
          channel_type?: string
          bot_id?: string
        }

        // Ignore bot messages
        if (msg.bot_id) return

        const text = msg.text?.trim()
        if (!text) return

        const { workspaceId, userId } = connection
        const threadId = await getOrCreateThreadId(redis, connection.teamId ?? workspaceId, msg.channel)

        // Acknowledge with a typing indicator
        const typingMsg = await say({ text: '…', channel: msg.channel })

        const [userMessage] = await withWorkspace(db, workspaceId, async (tx) =>
          tx
            .insert(messages)
            .values({
              workspaceId,
              threadId,
              role: 'user',
              content: text,
              channel: 'slack',
              userId,
            })
            .returning()
        )

        const [run] = await withWorkspace(db, workspaceId, async (tx) =>
          tx.insert(agentRuns).values({ workspaceId, trigger: 'user_message', input: text }).returning()
        )

        // Store reply target so the subscriber above can send back
        await redis.set(
          `${PENDING_REPLY_PREFIX}${run.id}`,
          JSON.stringify({
            botToken: connection.botToken,
            channelId: msg.channel,
            threadTs: msg.thread_ts ?? msg.ts,
          }),
          'EX',
          300
        )

        // Delete the placeholder typing message
        if (typingMsg.ts && connection.appToken) {
          const { WebClient } = await import('@slack/web-api')
          const client = new WebClient(connection.botToken)
          await client.chat.delete({ channel: msg.channel, ts: typingMsg.ts as string }).catch(() => {})
        }

        await agentQueue.add(
          'run',
          { workspaceId, threadId, messageId: userMessage.id, agentRunId: run.id, userId },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 500 }
        )
      })

      await app.start()
      apps.set(connection.workspaceId, app)
      console.log(`[slack] Bot started for workspace ${connection.workspaceId} (team: ${connection.teamName ?? 'unknown'})`)
    } catch (err) {
      console.error(`[slack] Failed to start bot for workspace ${connection.workspaceId}:`, err)
    }
  }

  async function refreshConnections() {
    const connections = await db.query.slackConnections.findMany()
    for (const conn of connections) {
      await launchApp(conn)
    }
  }

  // Start all configured bots
  await refreshConnections()

  return {
    stop: async () => {
      for (const [, app] of apps) {
        await app.stop()
      }
      subscriber.punsubscribe()
      await subscriber.quit()
    },
    refreshConnections,
  }
}
