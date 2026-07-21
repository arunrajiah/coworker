import { tool } from 'ai'
import { z } from 'zod'
import { specs } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'

export function createSpecTool(db: DbClient, workspaceId: string, userId: string) {
  return tool({
    description:
      'Create a new spec (requirement, blueprint, or feedback doc) in the workspace. Use this when the user asks you to document a requirement, record an architecture decision, or structure raw feedback into a spec.',
    parameters: z.object({
      title: z.string().describe('Clear, concise title for the spec'),
      content: z.string().describe('Full spec content in markdown. For requirements include Overview and Acceptance Criteria sections. For blueprints include Architecture and Rationale. For feedback include raw feedback and Structured Issues.'),
      type: z.enum(['requirement', 'blueprint', 'feedback']).default('requirement'),
      status: z.enum(['draft', 'active']).default('draft').describe('Use active when the spec is finalised and ready to drive tasks'),
    }),
    execute: async ({ title, content, type, status }) => {
      const [spec] = await withWorkspace(db, workspaceId, async (tx) =>
        tx
          .insert(specs)
          .values({ workspaceId, title, content, type, status, createdBy: userId })
          .returning({ id: specs.id, title: specs.title, type: specs.type, status: specs.status })
      )

      return spec
    },
  })
}
