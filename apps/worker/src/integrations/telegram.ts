import { Telegraf } from 'telegraf'
import { message } from 'telegraf/filters'
import { eq } from 'drizzle-orm'
import { telegramConnections, workspaces, messages, agentRuns } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import type { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import { nanoid } from 'nanoid'
import type { AgentJobData } from '../agent/executor.js'

const CONNECT_CODE_PREFIX = 'tg:connect:'
const PENDING_REPLY_PREFIX = 'tg:reply:'
const THREAD_PREFIX = 'tg:thread:'

// Returns a stable thread ID for a given Telegram chat (persisted in Redis)
async function getOrCreateThreadId(redis: Redis, chatId: number): Promise<string> {
  const key = `${THREAD_PREFIX}${chatId}`
  let threadId = await redis.get(key)
  if (!threadId) {
    threadId = nanoid()
    await redis.set(key, threadId) // no expiry — thread persists
  }
  return threadId
}

export function startTelegramBot(
  token: string,
  db: DbClient,
  redis: Redis,
  agentQueue: Queue<AgentJobData>
) {
  const bot = new Telegraf(token)

  // ── /start ────────────────────────────────────────────────────────────────

  bot.start((ctx) =>
    ctx.reply(
      "Hi! I'm your Coworker bot.\n\n" +
        'To connect me to your workspace:\n' +
        '1. Go to Settings in your Coworker app\n' +
        '2. Click "Connect Telegram"\n' +
        '3. Copy the code and send it here as:\n' +
        '   /connect <your-code>\n\n' +
        'Once connected, just send me a message and I\'ll get to work.'
    )
  )

  // ── /connect <code> ───────────────────────────────────────────────────────

  bot.command('connect', async (ctx) => {
    const code = ctx.message.text.split(' ')[1]?.trim()

    if (!code) {
      return ctx.reply('Usage: /connect <code>\n\nGet your code from Settings → Telegram.')
    }

    const value = await redis.get(`${CONNECT_CODE_PREFIX}${code}`)
    if (!value) {
      return ctx.reply('That code is invalid or has expired. Generate a new one from Settings.')
    }

    const [workspaceId, userId] = value.split(':')
    const chatId = ctx.chat.id
    const username = ctx.from?.username ?? null

    const existing = await db.query.telegramConnections.findFirst({
      where: eq(telegramConnections.telegramChatId, chatId),
    })

    if (existing) {
      await db
        .update(telegramConnections)
        .set({ workspaceId, userId, telegramUsername: username })
        .where(eq(telegramConnections.telegramChatId, chatId))
    } else {
      await db.insert(telegramConnections).values({ workspaceId, userId, telegramChatId: chatId, telegramUsername: username })
    }

    await redis.del(`${CONNECT_CODE_PREFIX}${code}`)

    const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })

    return ctx.reply(
      `Connected to "${workspace?.name ?? 'your workspace'}"!\n\n` +
        "Send me a message and I'll handle it just like the web app.\n\n" +
        'Send /disconnect to unlink this chat.'
    )
  })

  // ── /disconnect ───────────────────────────────────────────────────────────

  bot.command('disconnect', async (ctx) => {
    await db
      .delete(telegramConnections)
      .where(eq(telegramConnections.telegramChatId, ctx.chat.id))
    return ctx.reply('Disconnected. Your conversation history is preserved in the app.')
  })

  // ── Regular text messages ─────────────────────────────────────────────────

  bot.on(message('text'), async (ctx) => {
    const chatId = ctx.chat.id
    const text = ctx.message.text

    const connection = await db.query.telegramConnections.findFirst({
      where: eq(telegramConnections.telegramChatId, chatId),
    })

    if (!connection) {
      return ctx.reply('Not connected yet. Send /start for setup instructions.')
    }

    const { workspaceId, userId } = connection
    const threadId = await getOrCreateThreadId(redis, chatId)

    await ctx.sendChatAction('typing')

    const [userMessage] = await withWorkspace(db, workspaceId, async (tx) =>
      tx
        .insert(messages)
        .values({ workspaceId, threadId, role: 'user', content: text, channel: 'telegram', userId })
        .returning()
    )

    const [run] = await withWorkspace(db, workspaceId, async (tx) =>
      tx.insert(agentRuns).values({ workspaceId, trigger: 'user_message', input: text }).returning()
    )

    await redis.set(`${PENDING_REPLY_PREFIX}${run.id}`, String(chatId), 'EX', 300)

    await agentQueue.add(
      'run',
      { workspaceId, threadId, messageId: userMessage.id, agentRunId: run.id, userId },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 500 }
    )
  })

  // ── Subscribe to Redis for async agent replies ────────────────────────────

  const subscriber = redis.duplicate()
  subscriber.psubscribe('ws:*')

  subscriber.on('pmessage', async (_pattern, _channel, raw) => {
    try {
      const event = JSON.parse(raw)
      if (event.type !== 'agent:message') return

      const chatIdStr = await redis.get(`${PENDING_REPLY_PREFIX}${event.agentRunId}`)
      if (!chatIdStr) return

      await redis.del(`${PENDING_REPLY_PREFIX}${event.agentRunId}`)

      const chatId = parseInt(chatIdStr, 10)
      const text: string = event.message?.content
      if (!text) return

      for (const chunk of splitMessage(text, 4000)) {
        await bot.telegram.sendMessage(chatId, chunk, { parse_mode: 'Markdown' })
      }
    } catch {
      // Swallow parse/send errors
    }
  })

  bot.launch()
  console.log('[telegram] Bot started')

  return {
    stop: () => {
      bot.stop()
      subscriber.punsubscribe()
      subscriber.quit()
    },
  }
}

export async function generateTelegramConnectCode(
  redis: Redis,
  workspaceId: string,
  userId: string
): Promise<string> {
  const code = nanoid(12)
  await redis.set(`${CONNECT_CODE_PREFIX}${code}`, `${workspaceId}:${userId}`, 'EX', 600)
  return code
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
