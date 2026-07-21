import { tool } from 'ai'
import { z } from 'zod'
import { specs } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import { eq, and, like } from 'drizzle-orm'

export function searchSpecsTool(db: DbClient, workspaceId: string) {
  return tool({
    description:
      'Search requirements, blueprints, and feedback specs in the workspace. Use this before creating tasks to check if there is a spec that provides context or acceptance criteria for the work.',
    parameters: z.object({
      query: z.string().optional().describe('Search term to filter specs by title'),
      type: z.enum(['requirement', 'blueprint', 'feedback']).optional().describe('Filter by spec type'),
      status: z.enum(['draft', 'active', 'deprecated']).optional().describe('Filter by status — prefer active'),
      limit: z.number().min(1).max(20).default(10),
    }),
    execute: async ({ query, type, status, limit }) => {
      const result = await withWorkspace(db, workspaceId, async (tx) => {
        const conditions = [eq(specs.workspaceId, workspaceId)]
        if (type) conditions.push(eq(specs.type, type))
        if (status) conditions.push(eq(specs.status, status))
        if (query) {
          const safe = query.replace(/[%_\\]/g, (c) => `\\${c}`)
          conditions.push(like(specs.title, `%${safe}%`))
        }

        return tx.query.specs.findMany({
          where: and(...conditions),
          limit,
          columns: { id: true, title: true, type: true, status: true, content: true, updatedAt: true },
        })
      })

      return result.map((s) => ({
        ...s,
        // Truncate content to keep context window lean
        content: s.content.length > 800 ? s.content.slice(0, 800) + '…' : s.content,
      }))
    },
  })
}
