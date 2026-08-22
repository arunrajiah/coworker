import { Queue } from 'bullmq'
import { createHash } from 'node:crypto'
import type { Redis } from 'ioredis'
import type { DbClient } from '@coworker/db'
import { eq, and } from 'drizzle-orm'
import { autopilotRules, workspaceMembers } from '@coworker/db'
import { withWorkspace, withSystemContext } from '@coworker/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// messages.thread_id is a uuid column, so every thread id must be a real uuid.
// Hashing the seed keeps ids deterministic (same event -> same thread).
function uuidFromSeed(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export interface AutopilotJobData {
  ruleId: string
  ruleName: string
  workspaceId: string
  actionType: string
  actionConfig: Record<string, unknown>
}

// Registers all active schedule-based autopilot rules as BullMQ repeatable jobs.
// Called on worker startup and whenever rules change.
export async function syncScheduledRules(
  db: DbClient,
  autopilotQueue: Queue<AutopilotJobData>
): Promise<void> {
  // Load all active schedule-triggered rules across all workspaces
  const rules = await withSystemContext(db, async (tx) =>
    tx.query.autopilotRules.findMany({
      where: and(
        eq(autopilotRules.triggerType, 'schedule'),
        eq(autopilotRules.isActive, true)
      ),
    })
  )

  // Get existing repeatable jobs
  const existing = await autopilotQueue.getRepeatableJobs()
  const existingKeys = new Set(existing.map((j) => j.key))

  for (const rule of rules) {
    const config = rule.triggerConfig as { cron?: string }
    if (!config.cron) continue

    const jobKey = `rule:${rule.id}`

    // Skip if already scheduled
    if (existingKeys.has(jobKey)) continue

    await autopilotQueue.add(
      'run-rule',
      {
        ruleId: rule.id,
        ruleName: rule.name,
        workspaceId: rule.workspaceId,
        actionType: rule.actionType,
        actionConfig: rule.actionConfig as Record<string, unknown>,
      },
      {
        repeat: { pattern: config.cron },
        jobId: jobKey,
      }
    )

    console.log(`[autopilot] Scheduled rule "${rule.name}" (${config.cron})`)
  }

  // Remove jobs for rules that no longer exist or are inactive
  for (const job of existing) {
    const ruleId = job.key?.replace('rule:', '')
    const stillActive = rules.some((r) => r.id === ruleId)
    if (!stillActive) {
      await autopilotQueue.removeRepeatableByKey(job.key)
      console.log(`[autopilot] Removed stale schedule for rule ${ruleId}`)
    }
  }
}

export interface GitEventPayload {
  type: string
  action?: string
  connectionId: string
  workspaceId: string
  provider: string
  repo: string
  payload: unknown
}

// Called when a git event arrives via Redis; fires matching autopilot rules.
export async function handleGitEvent(
  db: DbClient,
  autopilotQueue: Queue<AutopilotJobData>,
  event: GitEventPayload
): Promise<void> {
  const { type, action, workspaceId, connectionId, repo, payload } = event

  const triggerType =
    type === 'issues' && (action === 'opened' || action === 'created' || action === 'open')
      ? 'git_issue_opened'
      : type === 'pull_request' && (action === 'opened' || action === 'created' || action === 'open')
      ? 'git_pr_opened'
      : null

  if (!triggerType) return

  const rules = await withWorkspace(db, workspaceId, async (tx) =>
    tx.query.autopilotRules.findMany({
      where: and(
        eq(autopilotRules.workspaceId, workspaceId),
        eq(autopilotRules.triggerType, triggerType as any),
        eq(autopilotRules.isActive, true)
      ),
    })
  )

  if (rules.length === 0) return

  // Extract human-readable context from the raw payload
  const p = payload as Record<string, unknown>
  const issueOrPR = (p.issue ?? p.pull_request ?? p.object_attributes ?? p) as Record<string, unknown>
  const title = (issueOrPR.title as string) ?? '(no title)'
  const body = (issueOrPR.body ?? issueOrPR.description ?? '') as string
  const url = (issueOrPR.html_url ?? issueOrPR.web_url ?? '') as string
  const number = (issueOrPR.number ?? issueOrPR.iid) as number | undefined
  const author = ((issueOrPR.user as Record<string, unknown>)?.login ?? (issueOrPR.author as Record<string, unknown>)?.username ?? 'unknown') as string
  const labelList = Array.isArray(issueOrPR.labels)
    ? (issueOrPR.labels as any[]).map((l) => (typeof l === 'string' ? l : l?.name ?? '')).filter(Boolean).join(', ')
    : ''

  const eventContext = [
    `Repo: ${repo}`,
    number ? `${type === 'pull_request' ? 'PR' : 'Issue'} #${number}: ${title}` : `Title: ${title}`,
    url ? `URL: ${url}` : '',
    `Opened by: ${author}`,
    labelList ? `Labels: ${labelList}` : '',
    body ? `\nDescription:\n${body.slice(0, 1000)}${body.length > 1000 ? '…' : ''}` : '',
  ].filter(Boolean).join('\n')

  for (const rule of rules) {
    const config = rule.triggerConfig as { connectionId?: string }
    if (config.connectionId && config.connectionId !== connectionId) continue

    const actionConfig = rule.actionConfig as Record<string, unknown>
    const basePrompt = (actionConfig.prompt as string) ?? 'Process this git event and take appropriate action.'
    const fullPrompt = `${basePrompt}\n\n--- Git Event ---\n${eventContext}`

    // Use a unique thread per event so each issue/PR gets fresh agent context
    const eventThreadId = uuidFromSeed(`git:${connectionId}:${type}:${number ?? Date.now()}`)

    await autopilotQueue.add(
      'run-rule',
      {
        ruleId: rule.id,
        ruleName: rule.name,
        workspaceId,
        actionType: rule.actionType,
        actionConfig: { ...actionConfig, prompt: fullPrompt, threadId: eventThreadId },
      },
      { attempts: 2 }
    )
  }
}

export async function executeAutopilotRule(
  db: DbClient,
  redis: Redis,
  agentQueue: Queue,
  data: AutopilotJobData
): Promise<void> {
  const { ruleId, ruleName, workspaceId, actionType, actionConfig } = data

  // Update lastRunAt
  await db
    .update(autopilotRules)
    .set({ lastRunAt: new Date() })
    .where(eq(autopilotRules.id, ruleId))

  if (actionType === 'run_agent') {
    const prompt = (actionConfig as { prompt?: string }).prompt
    if (!prompt) return

    // Find the workspace owner to attribute the run to
    const owner = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, 'owner')
      ),
    })
    if (!owner) return

    // Use event-scoped thread if provided (git events), otherwise the rule id as
    // a persistent per-rule thread. Non-uuid ids (e.g. jobs queued before the
    // uuid migration) are hashed into one.
    const configuredThreadId = (actionConfig as { threadId?: string }).threadId
    const threadId = configuredThreadId
      ? UUID_RE.test(configuredThreadId)
        ? configuredThreadId
        : uuidFromSeed(configuredThreadId)
      : ruleId

    // Save the trigger as a system message so the agent has context
    const { messages } = await import('@coworker/db')

    await withWorkspace(db, workspaceId, async (tx) =>
      tx.insert(messages).values({
        workspaceId,
        role: 'user',
        content: prompt,
        threadId,
        channel: 'web',
        userId: owner.userId,
        metadata: { autopilot: true, ruleId, ruleName },
      })
    )

    // Import agentRuns inside to avoid circular deps
    const { agentRuns } = await import('@coworker/db')
    const [run] = await withWorkspace(db, workspaceId, async (tx) =>
      tx
        .insert(agentRuns)
        .values({ workspaceId, trigger: 'autopilot', input: prompt })
        .returning()
    )

    await agentQueue.add(
      'run',
      {
        workspaceId,
        threadId,
        agentRunId: run.id,
        userId: owner.userId,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
      }
    )

    // Notify WebSocket that autopilot fired
    await redis.publish(
      `ws:${workspaceId}`,
      JSON.stringify({ type: 'autopilot:triggered', ruleId, ruleName })
    )
  }

  if (actionType === 'create_task') {
    const { title, priority } = actionConfig as { title?: string; priority?: string }
    if (!title) return

    const { tasks } = await import('@coworker/db')
    const owner = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, 'owner')
      ),
    })
    if (!owner) return

    await withWorkspace(db, workspaceId, async (tx) =>
      tx.insert(tasks).values({
        workspaceId,
        title,
        priority: (priority ?? 'medium') as any,
        createdBy: owner.userId,
        agentOwned: true,
      })
    )
  }
}
