import { tool } from 'ai'
import { z } from 'zod'
import { tasks } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import type { Redis } from 'ioredis'

const DOMAINS = ['general', 'development', 'qa', 'marketing', 'finance', 'design', 'operations', 'hr', 'legal', 'sales'] as const

export function createTaskTool(db: DbClient, redis: Redis, workspaceId: string, userId: string) {
  return tool({
    description:
      'Create a single new task in the workspace. Use this for one task at a time. For planning multiple tasks across domains, use plan_work instead.',
    parameters: z.object({
      title: z.string().describe('Short, clear task title'),
      description: z.string().optional().describe('Additional context or details'),
      domain: z.enum(DOMAINS).optional().default('general').describe('Business domain for this task'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
      labels: z.array(z.string()).optional().default([]),
      dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
    }),
    execute: async ({ title, description, domain, priority, labels, dueDate }) => {
      const [task] = await withWorkspace(db, workspaceId, async (tx) =>
        tx
          .insert(tasks)
          .values({
            workspaceId,
            createdBy: userId,
            title,
            description: description ?? null,
            domain: domain ?? 'general',
            priority: priority ?? 'medium',
            labels: labels ?? [],
            dueDate: dueDate ?? null,
            agentOwned: true,
          })
          .returning()
      )

      await redis.publish(`ws:${workspaceId}`, JSON.stringify({ type: 'task:created', task }))

      return { id: task.id, title: task.title, domain: task.domain, status: task.status, priority: task.priority }
    },
  })
}
