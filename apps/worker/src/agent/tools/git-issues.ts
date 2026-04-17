import { tool } from 'ai'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { gitConnections } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { createGitAdapter } from '@coworker/adapter-git'

export function listIssuesTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List issues from a connected git repository (GitHub, GitLab, or Bitbucket).',
    parameters: z.object({
      connectionId: z.string().describe('The git connection ID to use'),
      state: z.enum(['open', 'closed', 'all']).optional().default('open'),
    }),
    execute: async ({ connectionId, state }) => {
      const conn = await db.query.gitConnections.findFirst({
        where: and(eq(gitConnections.id, connectionId), eq(gitConnections.workspaceId, workspaceId)),
      })
      if (!conn) return { error: 'Git connection not found' }

      const adapter = createGitAdapter(conn.provider, conn.accessToken)
      const issues = await adapter.listIssues(conn.repoOwner, conn.repoName, state)
      return { issues, total: issues.length }
    },
  })
}

export function createIssueTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Create a new issue in a connected git repository.',
    parameters: z.object({
      connectionId: z.string().describe('The git connection ID to use'),
      title: z.string(),
      body: z.string().optional(),
      labels: z.array(z.string()).optional(),
      assignees: z.array(z.string()).optional(),
    }),
    execute: async ({ connectionId, title, body, labels, assignees }) => {
      const conn = await db.query.gitConnections.findFirst({
        where: and(eq(gitConnections.id, connectionId), eq(gitConnections.workspaceId, workspaceId)),
      })
      if (!conn) return { error: 'Git connection not found' }

      const adapter = createGitAdapter(conn.provider, conn.accessToken)
      const issue = await adapter.createIssue(conn.repoOwner, conn.repoName, { title, body, labels, assignees })
      return issue
    },
  })
}

export function updateIssueTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Update an existing issue in a connected git repository.',
    parameters: z.object({
      connectionId: z.string().describe('The git connection ID to use'),
      issueNumber: z.number().describe('The issue number to update'),
      title: z.string().optional(),
      body: z.string().optional(),
      state: z.enum(['open', 'closed']).optional(),
      labels: z.array(z.string()).optional(),
    }),
    execute: async ({ connectionId, issueNumber, title, body, state, labels }) => {
      const conn = await db.query.gitConnections.findFirst({
        where: and(eq(gitConnections.id, connectionId), eq(gitConnections.workspaceId, workspaceId)),
      })
      if (!conn) return { error: 'Git connection not found' }

      const adapter = createGitAdapter(conn.provider, conn.accessToken)
      const issue = await adapter.updateIssue(conn.repoOwner, conn.repoName, issueNumber, { title, body, state, labels })
      return issue
    },
  })
}

export function listPRsTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List pull requests (or merge requests) from a connected git repository.',
    parameters: z.object({
      connectionId: z.string().describe('The git connection ID to use'),
      state: z.enum(['open', 'closed', 'all']).optional().default('open'),
    }),
    execute: async ({ connectionId, state }) => {
      const conn = await db.query.gitConnections.findFirst({
        where: and(eq(gitConnections.id, connectionId), eq(gitConnections.workspaceId, workspaceId)),
      })
      if (!conn) return { error: 'Git connection not found' }

      const adapter = createGitAdapter(conn.provider, conn.accessToken)
      const prs = await adapter.listPullRequests(conn.repoOwner, conn.repoName, state)
      return { pullRequests: prs, total: prs.length }
    },
  })
}

export function listGitConnectionsTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List all git repository connections for this workspace.',
    parameters: z.object({}),
    execute: async () => {
      const connections = await db.query.gitConnections.findMany({
        where: eq(gitConnections.workspaceId, workspaceId),
        columns: { accessToken: false, webhookSecret: false },
      })
      return { connections }
    },
  })
}
