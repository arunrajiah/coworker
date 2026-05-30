import { eq } from 'drizzle-orm'
import { whatsappConnections } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import type { Redis } from 'ioredis'

const PENDING_REPLY_PREFIX = 'wa:reply:'

export interface WhatsappReplyService {
  stop: () => Promise<void>
  /** Look up the from-number for a workspace to use when sending */
  getFromNumber: (workspaceId: string) => Promise<string | null>
}

/**
 * Starts a Redis subscriber that listens for agent:message events and
 * sends the reply back via the workspace's Twilio WhatsApp number.
 */
export async function startWhatsappReplyService(
  db: DbClient,
  redis: Redis
): Promise<WhatsappReplyService> {
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

      const { accountSid, authToken, fromNumber, toNumber } = JSON.parse(replyTarget) as {
        accountSid: string
        authToken: string
        fromNumber: string
        toNumber: string
      }

      const content = (event.message as { content?: string } | null)?.content
      if (!content) return

      // Send reply via Twilio REST (dynamic import avoids loading twilio at startup)
      const { default: Twilio } = await import('twilio')
      const client = Twilio(accountSid, authToken)

      // Split long messages (WhatsApp has a 1600-char limit)
      const chunks = splitMessage(content, 1500)
      for (const chunk of chunks) {
        await client.messages.create({
          from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
          to: toNumber.startsWith('whatsapp:') ? toNumber : `whatsapp:${toNumber}`,
          body: chunk,
        })
      }
    } catch (err) {
      console.error('[whatsapp] Reply send error:', err)
    }
  })

  return {
    stop: async () => {
      subscriber.punsubscribe()
      await subscriber.quit()
    },
    getFromNumber: async (workspaceId: string) => {
      const conn = await db.query.whatsappConnections.findFirst({
        where: eq(whatsappConnections.workspaceId, workspaceId),
      })
      return conn?.fromNumber ?? null
    },
  }
}

/** Store reply metadata in Redis so the subscriber above can send it */
export async function storeWhatsappPendingReply(
  redis: Redis,
  agentRunId: string,
  data: { accountSid: string; authToken: string; fromNumber: string; toNumber: string }
): Promise<void> {
  await redis.set(`${PENDING_REPLY_PREFIX}${agentRunId}`, JSON.stringify(data), 'EX', 300)
}

function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > maxLen) {
    const idx = remaining.lastIndexOf('\n', maxLen)
    const cut = idx > maxLen / 2 ? idx : maxLen
    chunks.push(remaining.slice(0, cut))
    remaining = remaining.slice(cut).trimStart()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}
