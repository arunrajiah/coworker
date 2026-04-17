import { tool } from 'ai'
import { z } from 'zod'
import { tasks } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import type { Redis } from 'ioredis'

const DOMAINS = ['general', 'development', 'qa', 'marketing', 'finance', 'design', 'operations', 'hr', 'legal', 'sales'] as const
const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

const taskItemSchema = z.object({
  title: z.string().min(1).max(500).describe('Clear, action-oriented task title'),
  description: z.string().max(2000).optional().describe('Detailed description of what needs to be done'),
  domain: z.enum(DOMAINS).describe('Which business domain this task belongs to'),
  priority: z.enum(PRIORITIES).default('medium'),
  status: z.enum(STATUSES).default('todo'),
  dueDate: z.string().optional().describe('ISO date string, e.g. 2025-05-01'),
  agentOwned: z.boolean().default(true).describe('True if the AI agent should execute this'),
  labels: z.array(z.string()).default([]),
})

export function planWorkTool(db: DbClient, redis: Redis, workspaceId: string, userId: string) {
  return tool({
    description:
      'Break down a large goal into multiple tasks across different business domains (development, marketing, finance, QA, etc.) and add them all to the board at once. Use this when the user asks you to plan or orchestrate work across teams.',
    parameters: z.object({
      goal: z.string().describe('The high-level goal or initiative being planned'),
      tasks: z
        .array(taskItemSchema)
        .min(1)
        .max(30)
        .describe('List of tasks to create across domains'),
    }),
    execute: async ({ goal, tasks: taskList }) => {
      const created = await withWorkspace(db, workspaceId, async (tx) =>
        tx
          .insert(tasks)
          .values(
            taskList.map((t) => ({
              workspaceId,
              createdBy: userId,
              title: t.title,
              description: t.description ?? null,
              domain: t.domain,
              status: t.status,
              priority: t.priority,
              dueDate: t.dueDate ?? null,
              labels: t.labels,
              agentOwned: t.agentOwned,
              queuedForAgent: false,
            }))
          )
          .returning()
      )

      for (const task of created) {
        await redis.publish(
          `ws:${workspaceId}`,
          JSON.stringify({ type: 'task:created', task })
        )
      }

      const byDomain = created.reduce<Record<string, number>>((acc, t) => {
        acc[t.domain] = (acc[t.domain] ?? 0) + 1
        return acc
      }, {})

      return {
        goal,
        tasksCreated: created.length,
        breakdown: byDomain,
        taskIds: created.map((t) => t.id),
        message: `Created ${created.length} tasks across ${Object.keys(byDomain).join(', ')}. They're live on the board.`,
      }
    },
  })
}
