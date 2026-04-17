import { Worker, Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { getEnv } from '@coworker/config'
import { createClient } from '@coworker/db'
import { executeAgentRun, type AgentJobData } from './agent/executor.js'
import { syncScheduledRules, executeAutopilotRule, type AutopilotJobData } from './autopilot/scheduler.js'
import { startTelegramBot } from './integrations/telegram.js'

const env = getEnv()

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
const db = createClient(env.DATABASE_URL)

// Two queues: agent runs (user-triggered) and autopilot (scheduled/event)
const agentQueue = new Queue<AgentJobData>('agent-runs', { connection: redis })
const autopilotQueue = new Queue<AutopilotJobData>('autopilot', { connection: redis })

// ── Agent worker ─────────────────────────────────────────────────────────────

const agentWorker = new Worker<AgentJobData>(
  'agent-runs',
  async (job) => {
    console.log(`[agent] Run ${job.data.agentRunId} started`)
    await executeAgentRun(db, redis, job.data)
  },
  { connection: redis, concurrency: 5 }
)

agentWorker.on('completed', (job) => console.log(`[agent] Job ${job.id} done`))
agentWorker.on('failed', (job, err) => console.error(`[agent] Job ${job?.id} failed: ${err.message}`))

// ── Autopilot worker ─────────────────────────────────────────────────────────

const autopilotWorker = new Worker<AutopilotJobData>(
  'autopilot',
  async (job) => {
    console.log(`[autopilot] Rule ${job.data.ruleId} triggered`)
    await executeAutopilotRule(db, redis, agentQueue, job.data)
  },
  { connection: redis, concurrency: 3 }
)

autopilotWorker.on('failed', (job, err) =>
  console.error(`[autopilot] Job ${job?.id} failed: ${err.message}`)
)

// ── Listen for rule sync + manual run signals from the API ───────────────────

const syncSubscriber = redis.duplicate()
await syncSubscriber.subscribe('autopilot:sync', 'autopilot:run')
syncSubscriber.on('message', async (channel, message) => {
  if (channel === 'autopilot:sync') {
    await syncScheduledRules(db, autopilotQueue)
  } else if (channel === 'autopilot:run') {
    const data = JSON.parse(message) as AutopilotJobData
    await autopilotQueue.add('run-rule', data, { attempts: 2 })
  }
})

// ── Initial sync on startup ──────────────────────────────────────────────────

await syncScheduledRules(db, autopilotQueue)
console.log('[autopilot] Scheduled rules synced')
console.log('[worker] Agent worker ready')

// ── Telegram bot (optional) ───────────────────────────────────────────────────

let telegramBot: ReturnType<typeof startTelegramBot> | undefined

if (env.TELEGRAM_BOT_TOKEN) {
  telegramBot = startTelegramBot(env.TELEGRAM_BOT_TOKEN, db, redis, agentQueue)
} else {
  console.log('[telegram] No TELEGRAM_BOT_TOKEN set — Telegram integration disabled')
}

// ── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGTERM', async () => {
  console.log('[worker] Shutting down...')
  telegramBot?.stop()
  await agentWorker.close()
  await autopilotWorker.close()
  await syncSubscriber.unsubscribe()
  await redis.quit()
  process.exit(0)
})
