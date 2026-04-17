import { tool } from 'ai'
import { z } from 'zod'
import { tasks } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import { eq, and, like } from 'drizzle-orm'

export function searchTasksTool(db: DbClient, workspaceId: string) {
  return tool({
    description:
      'Search and list tasks in the workspace. Use this to find existing tasks, check what is open, or look for specific work items.',
    parameters: z.object({
      query: z.string().optional().describe('Search term to filter tasks by title'),
      status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled']).optional(),
      domain: z.enum(['general', 'development', 'qa', 'marketing', 'finance', 'design', 'operations', 'hr', 'legal', 'sales']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      limit: z.number().min(1).max(50).default(20),
    }),
    execute: async ({ query, status, domain, priority, limit }) => {
      const result = await withWorkspace(db, workspaceId, async (tx) => {
        const conditions = [eq(tasks.workspaceId, workspaceId)]
        if (status) conditions.push(eq(tasks.status, status))
        if (domain) conditions.push(eq(tasks.domain, domain))
        if (priority) conditions.push(eq(tasks.priority, priority))
        if (query) {
          // Escape special LIKE chars
          const safe = query.replace(/[%_\\]/g, (c) => `\\${c}`)
          conditions.push(like(tasks.title, `%${safe}%`))
        }

        return tx.query.tasks.findMany({
          where: and(...conditions),
          limit,
          columns: { id: true, title: true, status: true, domain: true, priority: true, dueDate: true, labels: true },
        })
      })

      return result
    },
  })
}
