import { generateText, type CoreMessage } from 'ai'
import { eq, and, asc, desc, inArray } from 'drizzle-orm'
import { messages, agentRuns, skills, tasks, workspaces, files } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import type { Redis } from 'ioredis'
import { getLLMProvider, DEFAULT_MODELS, detectDefaultProviderName } from './provider.js'
import { buildSystemPrompt } from './prompt.js'
import { retrieveRelevantMemories, saveMemory } from './memory.js'
import { createTaskTool } from './tools/create-task.js'
import { searchTasksTool } from './tools/search-tasks.js'
import { updateTaskTool } from './tools/update-task.js'
import { listFilesTool } from './tools/list-files.js'
import { readFileTool } from './tools/read-file.js'
import { planWorkTool } from './tools/plan-work.js'
import { listIssuesTool, createIssueTool, updateIssueTool, listPRsTool, listGitConnectionsTool } from './tools/git-issues.js'
import { listVercelConnectionsTool, listDeploymentsTool, triggerDeploymentTool, getDeploymentStatusTool } from './tools/vercel.js'
import { listLinearConnectionsTool, listLinearIssuesTool, createLinearIssueTool, updateLinearIssueTool, searchLinearIssuesTool } from './tools/linear.js'
import { listNotionConnectionsTool, searchNotionTool, readNotionPageTool, createNotionPageTool, appendNotionPageTool, queryNotionDatabaseTool } from './tools/notion.js'
import { listGcalConnectionsTool, listCalendarsTool, listEventsTool, createEventTool, updateEventTool, deleteEventTool, findFreeTool } from './tools/gcal.js'
import { estimateCostUsd } from './cost.js'
import { budgetAlerts } from '@coworker/db'
import { sql } from 'drizzle-orm'
import type { TemplateType, ActiveSkill } from '@coworker/core'

export interface AgentJobData {
  workspaceId: string
  threadId: string
  messageId?: string  // populated by chat/telegram; autopilot omits it (executor loads thread history instead)
  agentRunId: string
  userId: string
}

export async function executeAgentRun(
  db: DbClient,
  redis: Redis,
  data: AgentJobData
): Promise<void> {
  const { workspaceId, threadId, agentRunId, userId } = data
  const startedAt = new Date()

  // Mark run as started
  await db
    .update(agentRuns)
    .set({ status: 'running', startedAt })
    .where(eq(agentRuns.id, agentRunId))

  await redis.publish(`ws:${workspaceId}`, JSON.stringify({ type: 'agent:thinking', agentRunId }))

  try {
    // Load workspace config
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })
    if (!workspace) throw new Error('Workspace not found')

    // Load active skills
    const activeSkillRows = await withWorkspace(db, workspaceId, async (tx) =>
      tx.query.skills.findMany({
        where: and(eq(skills.workspaceId, workspaceId), eq(skills.isActive, true)),
      })
    )
    const activeSkills: ActiveSkill[] = activeSkillRows.map((s) => ({
      id: s.id,
      name: s.name,
      prompt: s.prompt,
      triggerPhrase: s.triggerPhrase,
      tools: s.tools,
    }))

    // Load thread history (last 20 messages)
    const history = await withWorkspace(db, workspaceId, async (tx) =>
      tx.query.messages.findMany({
        where: and(eq(messages.workspaceId, workspaceId), eq(messages.threadId, threadId)),
        orderBy: [asc(messages.createdAt)],
        limit: 20,
      })
    )

    const lastMessage = history.at(-1)
    const userInput = lastMessage?.content ?? ''

    // Build file context if files were attached to the message
    let fileContext = ''
    const attachedFileIds = (lastMessage?.metadata as { fileIds?: string[] } | null)?.fileIds ?? []
    if (attachedFileIds.length > 0) {
      const attachedFiles = await withWorkspace(db, workspaceId, async (tx) =>
        tx.query.files.findMany({ where: inArray(files.id, attachedFileIds) })
      )
      if (attachedFiles.length > 0) {
        fileContext =
          '\n\n---\nThe user has attached the following files to this message:\n' +
          attachedFiles
            .map((f) => `- **${f.name}** (${f.mimeType ?? 'unknown type'}, ${f.sizeBytes ? Math.round(f.sizeBytes / 1024) + ' KB' : 'unknown size'}) — file ID: ${f.id}`)
            .join('\n')
      }
    }

    // Retrieve relevant memories
    const recentMemories = await retrieveRelevantMemories(db, workspaceId, userInput)

    // Summarize open tasks for context
    const openTasks = await withWorkspace(db, workspaceId, async (tx) =>
      tx.query.tasks.findMany({
        where: and(eq(tasks.workspaceId, workspaceId), eq(tasks.status, 'todo')),
        orderBy: [desc(tasks.createdAt)],
        limit: 10,
        columns: { id: true, title: true, priority: true, dueDate: true },
      })
    )
    const openTasksSummary =
      openTasks.length > 0
        ? openTasks.map((t) => `- [${t.priority}] ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ''}`).join('\n')
        : 'No open tasks.'

    const systemPrompt = buildSystemPrompt({
      workspaceName: workspace.name,
      templateType: workspace.templateType as TemplateType,
      activeSkills,
      recentMemories,
      openTasksSummary,
    })

    // Build message history for LLM
    const llmMessages: CoreMessage[] = history.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))
    llmMessages.push({ role: 'user', content: userInput + fileContext })

    const { chatModel } = getLLMProvider(
      workspace.llmProvider
        ? { provider: workspace.llmProvider as import('./provider.js').ProviderName, model: workspace.llmModel ?? undefined }
        : undefined
    )

    const tools = {
      create_task: createTaskTool(db, redis, workspaceId, userId),
      search_tasks: searchTasksTool(db, workspaceId),
      update_task: updateTaskTool(db, redis, workspaceId),
      list_files: listFilesTool(db, workspaceId),
      read_file: readFileTool(db, workspaceId),
      plan_work: planWorkTool(db, redis, workspaceId, userId),
      list_git_connections: listGitConnectionsTool(db, workspaceId),
      list_issues: listIssuesTool(db, workspaceId),
      create_issue: createIssueTool(db, workspaceId),
      update_issue: updateIssueTool(db, workspaceId),
      list_pull_requests: listPRsTool(db, workspaceId),
      list_vercel_connections: listVercelConnectionsTool(db, workspaceId),
      list_deployments: listDeploymentsTool(db, workspaceId),
      trigger_deployment: triggerDeploymentTool(db, workspaceId),
      get_deployment_status: getDeploymentStatusTool(db, workspaceId),
      list_linear_connections: listLinearConnectionsTool(db, workspaceId),
      list_linear_issues: listLinearIssuesTool(db, workspaceId),
      create_linear_issue: createLinearIssueTool(db, workspaceId),
      update_linear_issue: updateLinearIssueTool(db, workspaceId),
      search_linear_issues: searchLinearIssuesTool(db, workspaceId),
      list_notion_connections: listNotionConnectionsTool(db, workspaceId),
      search_notion: searchNotionTool(db, workspaceId),
      read_notion_page: readNotionPageTool(db, workspaceId),
      create_notion_page: createNotionPageTool(db, workspaceId),
      append_notion_page: appendNotionPageTool(db, workspaceId),
      query_notion_database: queryNotionDatabaseTool(db, workspaceId),
      list_gcal_connections: listGcalConnectionsTool(db, workspaceId),
      list_calendars: listCalendarsTool(db, workspaceId),
      list_events: listEventsTool(db, workspaceId),
      create_event: createEventTool(db, workspaceId),
      update_event: updateEventTool(db, workspaceId),
      delete_event: deleteEventTool(db, workspaceId),
      find_free_time: findFreeTool(db, workspaceId),
    }

    const result = await generateText({
      model: chatModel,
      system: systemPrompt,
      messages: llmMessages,
      tools,
      maxSteps: 10, // agentic loop limit
      onStepFinish: async ({ toolCalls }) => {
        if (toolCalls.length > 0) {
          await redis.publish(
            `ws:${workspaceId}`,
            JSON.stringify({
              type: 'agent:tool_call',
              agentRunId,
              tools: toolCalls.map((tc) => tc.toolName),
            })
          )
        }
      },
    })

    const output = result.text
    const tokensUsed = result.usage.totalTokens
    const promptTokens = result.usage.promptTokens
    const completionTokens = result.usage.completionTokens
    const durationMs = Date.now() - startedAt.getTime()

    const providerConfig = workspace.llmProvider
      ? { provider: workspace.llmProvider as import('./provider.js').ProviderName, model: workspace.llmModel ?? undefined }
      : undefined
    const resolvedProvider = providerConfig?.provider ?? (detectDefaultProviderName() ?? 'unknown')
    const resolvedModel = providerConfig?.model ?? DEFAULT_MODELS[resolvedProvider as import('./provider.js').ProviderName] ?? 'unknown'
    const costUsd = estimateCostUsd(resolvedModel, resolvedProvider, promptTokens, completionTokens)

    // Save assistant message with token + model metadata for UI display
    const [assistantMessage] = await withWorkspace(db, workspaceId, async (tx) =>
      tx
        .insert(messages)
        .values({
          workspaceId,
          role: 'assistant',
          content: output,
          threadId,
          agentRunId,
          toolCalls: result.toolCalls.length > 0 ? (result.toolCalls as any) : null,
          metadata: {
            tokensUsed,
            promptTokens,
            completionTokens,
            costUsd,
            provider: resolvedProvider,
            model: resolvedModel,
          },
        })
        .returning()
    )

    // Update agent run as completed
    await db
      .update(agentRuns)
      .set({
        status: 'completed',
        output,
        tokensUsed,
        promptTokens,
        completionTokens,
        costUsd: String(costUsd),
        durationMs,
        completedAt: new Date(),
        toolCalls: result.toolCalls.length > 0 ? (result.toolCalls as any) : null,
      })
      .where(eq(agentRuns.id, agentRunId))

    // Check budget alerts
    const budget = workspace.monthlyBudgetUsd ? Number(workspace.monthlyBudgetUsd) : null
    if (budget && budget > 0) {
      const month = new Date().toISOString().slice(0, 7) // YYYY-MM
      const spendRow = await withWorkspace(db, workspaceId, async (tx) =>
        tx.execute(
          sql`SELECT COALESCE(SUM(cost_usd::numeric), 0) AS total FROM tenant.agent_runs
              WHERE workspace_id = ${workspaceId}::uuid
                AND date_trunc('month', created_at) = date_trunc('month', now())`
        )
      )
      const monthSpend = Number((spendRow.rows[0] as { total: string }).total)
      const pct = (monthSpend / budget) * 100
      const thresholds = [workspace.budgetAlertThreshold, 100].filter((t) => pct >= t)

      for (const threshold of thresholds) {
        // INSERT ... ON CONFLICT DO NOTHING to avoid duplicate alerts per month
        await withWorkspace(db, workspaceId, async (tx) =>
          tx
            .insert(budgetAlerts)
            .values({
              workspaceId,
              month,
              thresholdPct: threshold,
              spendUsd: String(monthSpend),
              budgetUsd: String(budget),
            })
            .onConflictDoNothing()
        )
        await redis.publish(
          `ws:${workspaceId}`,
          JSON.stringify({
            type: 'budget:alert',
            month,
            thresholdPct: threshold,
            spendUsd: monthSpend,
            budgetUsd: budget,
          })
        )
      }
    }

    // Save memory of this interaction
    await saveMemory(
      db,
      workspaceId,
      `User: ${userInput}\nAssistant: ${output}`,
      'message',
      assistantMessage.id
    )

    // Broadcast completion
    await redis.publish(
      `ws:${workspaceId}`,
      JSON.stringify({
        type: 'agent:message',
        agentRunId,
        message: assistantMessage,
      })
    )
    await redis.publish(
      `ws:${workspaceId}`,
      JSON.stringify({ type: 'agent:complete', agentRunId })
    )
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`[agent] Run ${agentRunId} failed:`, error)

    await db
      .update(agentRuns)
      .set({
        status: 'failed',
        error,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
      })
      .where(eq(agentRuns.id, agentRunId))

    await redis.publish(
      `ws:${workspaceId}`,
      JSON.stringify({ type: 'agent:error', agentRunId, error })
    )

    throw err // Let BullMQ handle retries
  }
}
