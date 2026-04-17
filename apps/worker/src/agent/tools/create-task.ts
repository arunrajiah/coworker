import { tool } from 'ai'
import { z } from 'zod'
import { tasks } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import type { Redis } from 'ioredis'

export function createTaskTool(db: DbClient, redis: Redis, workspaceId: string, userId: string) {
  return tool({
    description:
      'Create a new task in the workspace. Use this when the user asks you to create, add, or track something as a task.',
    parameters: z.object({
      title: z.string().describe('Short, clear task title'),
      description: z.string().optional().describe('Additional context or details'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
      labels: z.array(z.string()).optional().default([]),
      dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
    }),
    execute: async ({ title, description, priority, labels, dueDate }) => {
      const [task] = await withWorkspace(db, workspaceId, async (tx) =>
        tx
          .insert(tasks)
          .values({
            workspaceId,
            createdBy: userId,
            title,
            description: description ?? null,
            priority: priority ?? 'medium',
            labels: labels ?? [],
            dueDate: dueDate ?? null,
            agentOwned: true,
          })
          .returning()
      )

      // Broadcast to WebSocket room
      await redis.publish(
        `ws:${workspaceId}`,
        JSON.stringify({ type: 'task:created', task })
      )

      return { id: task.id, title: task.title, status: task.status, priority: task.priority }
    },
  })
}
