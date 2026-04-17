import { Worker, Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { getEnv } from '@coworker/config'
import { createClient } from '@coworker/db'
import { executeAgentRun, type AgentJobData } from './agent/executor.js'
import { syncScheduledRules, executeAutopilotRule, handleGitEvent, type AutopilotJobData } from './autopilot/scheduler.js'
import { startTelegramBot } from './integrations/telegram.js'
import { processFile, type FileIngestionJobData } from './ingestion/index.js'

const env = getEnv()

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
const db = createClient(env.DATABASE_URL)

// Queues: agent runs, autopilot, and file ingestion
const agentQueue = new Queue<AgentJobData>('agent-runs', { connection: redis })
const autopilotQueue = new Queue<AutopilotJobData>('autopilot', { connection: redis })
export const fileIngestionQueue = new Queue<FileIngestionJobData>('file-ingestion', { connection: redis })

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

// ── File ingestion worker ────────────────────────────────────────────────────

const fileWorker = new Worker<FileIngestionJobData>(
  'file-ingestion',
  async (job) => {
    console.log(`[ingestion] Processing file ${job.data.fileId}`)
    await processFile(db, redis, job.data)
  },
  { connection: redis, concurrency: 3 }
)

fileWorker.on('completed', (job) => console.log(`[ingestion] Job ${job.id} done`))
fileWorker.on('failed', (job, err) => console.error(`[ingestion] Job ${job?.id} failed: ${err.message}`))

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

// ── Listen for rule sync, manual run signals, and git events ─────────────────

const syncSubscriber = redis.duplicate()
await syncSubscriber.subscribe('autopilot:sync', 'autopilot:run', 'git:events')
syncSubscriber.on('message', async (channel, message) => {
  if (channel === 'autopilot:sync') {
    await syncScheduledRules(db, autopilotQueue)
  } else if (channel === 'autopilot:run') {
    const data = JSON.parse(message) as AutopilotJobData
    await autopilotQueue.add('run-rule', data, { attempts: 2 })
  } else if (channel === 'git:events') {
    const gitEvent = JSON.parse(message) as {
      type: string; action?: string; connectionId: string
      workspaceId: string; provider: string; repo: string; payload: unknown
    }
    await handleGitEvent(db, autopilotQueue, gitEvent)
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
  await fileWorker.close()
  await syncSubscriber.unsubscribe()
  await redis.quit()
  process.exit(0)
})
