import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import type { DbClient } from '@coworker/db'
import { eq, and } from 'drizzle-orm'
import { autopilotRules, workspaceMembers } from '@coworker/db'
import { withWorkspace } from '@coworker/db'

export interface AutopilotJobData {
  ruleId: string
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
  const rules = await db.query.autopilotRules.findMany({
    where: and(
      eq(autopilotRules.triggerType, 'schedule'),
      eq(autopilotRules.isActive, true)
    ),
  })

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
  redis: Redis,
  autopilotQueue: Queue<AutopilotJobData>,
  agentQueue: Queue,
  event: GitEventPayload
): Promise<void> {
  const { type, action, workspaceId, connectionId, repo } = event

  const triggerType =
    type === 'issues' && (action === 'opened' || action === 'created' || action === 'open')
      ? 'git_issue_opened'
      : type === 'pull_request' && (action === 'opened' || action === 'created' || action === 'open')
      ? 'git_pr_opened'
      : null

  if (!triggerType) return

  const rules = await db.query.autopilotRules.findMany({
    where: and(
      eq(autopilotRules.workspaceId, workspaceId),
      eq(autopilotRules.triggerType, triggerType as any),
      eq(autopilotRules.isActive, true)
    ),
  })

  for (const rule of rules) {
    const config = rule.triggerConfig as { connectionId?: string }
    // If rule is scoped to a specific connection, skip non-matching events
    if (config.connectionId && config.connectionId !== connectionId) continue

    // Enrich the agent prompt with issue context
    const actionConfig = rule.actionConfig as Record<string, unknown>
    const contextPrompt = `${actionConfig.prompt ?? 'Process this git event.'}\n\nGit event:\n- Repo: ${repo}\n- Type: ${type}\n- Action: ${action ?? 'unknown'}\n- Connection ID: ${connectionId}`

    await autopilotQueue.add(
      'run-rule',
      {
        ruleId: rule.id,
        workspaceId,
        actionType: rule.actionType,
        actionConfig: { ...actionConfig, prompt: contextPrompt },
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
  const { ruleId, workspaceId, actionType, actionConfig } = data

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

    // Create a system thread for autopilot messages (persistent per rule)
    const threadId = `autopilot:${ruleId}`

    // Save the trigger as a system message so the agent has context
    const { messages } = await import('@coworker/db')
    const { nanoid } = await import('nanoid')

    await withWorkspace(db, workspaceId, async (tx) =>
      tx.insert(messages).values({
        workspaceId,
        role: 'user',
        content: prompt,
        threadId,
        channel: 'web',
        userId: owner.userId,
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
      JSON.stringify({ type: 'autopilot:triggered', ruleId, name: actionConfig.ruleName })
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
