import { tool } from 'ai'
import { z } from 'zod'
import { specs, tasks } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'

export function processFeedbackTool(db: DbClient, workspaceId: string, userId: string) {
  return tool({
    description:
      'Structure raw feedback (from Slack, email, a user interview, etc.) into a feedback spec and create actionable tasks from it. Use when the user pastes or describes raw feedback and wants it turned into work items.',
    parameters: z.object({
      rawFeedback: z.string().describe('The raw, unstructured feedback text'),
      source: z.string().optional().describe('Where the feedback came from, e.g. "Slack #feedback", "user interview", "support ticket"'),
      issues: z.array(z.object({
        title: z.string().describe('Short task title derived from the feedback'),
        description: z.string().describe('Context from the feedback explaining this issue'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
        domain: z.enum(['general', 'development', 'qa', 'marketing', 'finance', 'design', 'operations', 'hr', 'legal', 'sales']).default('general'),
      })).describe('Structured issues extracted from the feedback'),
    }),
    execute: async ({ rawFeedback, source, issues }) => {
      const title = source ? `Feedback: ${source}` : 'Feedback'
      const structuredSection = issues.map((iss, i) => `${i + 1}. **${iss.title}** (${iss.priority})\n   ${iss.description}`).join('\n')
      const content = `## Raw Feedback\n\n${rawFeedback}\n\n## Structured Issues\n\n${structuredSection}`

      const [spec] = await withWorkspace(db, workspaceId, async (tx) =>
        tx.insert(specs).values({ workspaceId, title, content, type: 'feedback', status: 'active', createdBy: userId }).returning()
      )

      const createdTasks = await withWorkspace(db, workspaceId, async (tx) =>
        Promise.all(
          issues.map((iss) =>
            tx
              .insert(tasks)
              .values({
                workspaceId,
                createdBy: userId,
                title: iss.title,
                description: iss.description,
                priority: iss.priority,
                domain: iss.domain,
                specId: spec.id,
                agentOwned: true,
                labels: ['feedback'],
              })
              .returning({ id: tasks.id, title: tasks.title })
          )
        ).then((rows) => rows.map((r) => r[0]))
      )

      return {
        specId: spec.id,
        specTitle: spec.title,
        tasksCreated: createdTasks.length,
        tasks: createdTasks,
      }
    },
  })
}
