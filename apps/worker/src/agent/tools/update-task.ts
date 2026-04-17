import { tool } from 'ai'
import { z } from 'zod'
import { tasks } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import { eq, and } from 'drizzle-orm'
import type { Redis } from 'ioredis'

export function updateTaskTool(db: DbClient, redis: Redis, workspaceId: string) {
  return tool({
    description: 'Update an existing task status, priority, or details.',
    parameters: z.object({
      taskId: z.string().uuid().describe('The task ID to update'),
      status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
    }),
    execute: async ({ taskId, ...updates }) => {
      const [updated] = await withWorkspace(db, workspaceId, async (tx) =>
        tx
          .update(tasks)
          .set({ ...updates, updatedAt: new Date() })
          .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
          .returning()
      )

      if (!updated) return { error: 'Task not found' }

      await redis.publish(
        `ws:${workspaceId}`,
        JSON.stringify({ type: 'task:updated', task: updated })
      )

      return { id: updated.id, title: updated.title, status: updated.status }
    },
  })
}
