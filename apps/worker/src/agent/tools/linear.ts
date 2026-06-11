import { tool } from 'ai'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { linearConnections } from '@coworker/db'
import type { DbClient } from '@coworker/db'

async function linearGql(apiKey: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Linear API ${res.status}`)
  const json = await res.json() as { data?: unknown; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data
}

async function getConn(db: DbClient, workspaceId: string, connectionId: string) {
  return db.query.linearConnections.findFirst({
    where: and(eq(linearConnections.id, connectionId), eq(linearConnections.workspaceId, workspaceId)),
  })
}

export function listLinearConnectionsTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List connected Linear workspaces for this coworker workspace.',
    parameters: z.object({}),
    execute: async () => {
      const rows = await db.query.linearConnections.findMany({
        where: eq(linearConnections.workspaceId, workspaceId),
        columns: { apiKey: false },
      })
      return rows.length > 0 ? rows : { message: 'No Linear connections configured.' }
    },
  })
}

export function listLinearIssuesTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List issues from a connected Linear team. Use list_linear_connections first to get connectionId.',
    parameters: z.object({
      connectionId: z.string().describe('Linear connection ID from list_linear_connections'),
      state: z.enum(['all', 'active', 'backlog', 'done', 'cancelled']).default('active').describe('Filter by issue state'),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    execute: async ({ connectionId, state, limit }) => {
      const conn = await getConn(db, workspaceId, connectionId)
      if (!conn) return { error: 'Linear connection not found' }

      const stateFilter = state === 'all' ? '' : `states: { type: { in: [${state === 'active' ? '"started","inProgress"' : `"${state}"`}] } },`
      const data = await linearGql(conn.apiKey, `
        query($teamId: String!, $first: Int!) {
          team(id: $teamId) {
            issues(first: $first, ${stateFilter} orderBy: updatedAt) {
              nodes {
                id identifier title description state { name type }
                priority assignee { name } dueDate url createdAt updatedAt
              }
            }
          }
        }
      `, { teamId: conn.teamId, first: limit }) as {
        team: { issues: { nodes: unknown[] } }
      }
      return { issues: data.team.issues.nodes, team: conn.teamName }
    },
  })
}

export function createLinearIssueTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Create a new issue in Linear.',
    parameters: z.object({
      connectionId: z.string(),
      title: z.string().describe('Issue title'),
      description: z.string().optional().describe('Markdown description'),
      priority: z.number().int().min(0).max(4).optional().describe('0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low'),
    }),
    execute: async ({ connectionId, title, description, priority }) => {
      const conn = await getConn(db, workspaceId, connectionId)
      if (!conn) return { error: 'Linear connection not found' }

      // Get the team's default state (first "backlog" or "unstarted" state)
      const teamData = await linearGql(conn.apiKey, `
        query($teamId: String!) {
          team(id: $teamId) {
            states { nodes { id name type } }
          }
        }
      `, { teamId: conn.teamId }) as { team: { states: { nodes: { id: string; name: string; type: string }[] } } }

      const defaultState = teamData.team.states.nodes.find((s) => s.type === 'backlog' || s.type === 'unstarted')

      const data = await linearGql(conn.apiKey, `
        mutation($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue { id identifier title url state { name } }
          }
        }
      `, {
        input: {
          teamId: conn.teamId,
          title,
          description,
          priority,
          stateId: defaultState?.id,
        },
      }) as { issueCreate: { success: boolean; issue: unknown } }

      return data.issueCreate
    },
  })
}

export function updateLinearIssueTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Update an existing Linear issue (title, description, priority, or state).',
    parameters: z.object({
      connectionId: z.string(),
      issueId: z.string().describe('Linear issue ID (from list_linear_issues)'),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.number().int().min(0).max(4).optional(),
      stateName: z.string().optional().describe('State name to move to (e.g. "In Progress", "Done")'),
    }),
    execute: async ({ connectionId, issueId, title, description, priority, stateName }) => {
      const conn = await getConn(db, workspaceId, connectionId)
      if (!conn) return { error: 'Linear connection not found' }

      let stateId: string | undefined
      if (stateName) {
        const teamData = await linearGql(conn.apiKey, `
          query($teamId: String!) { team(id: $teamId) { states { nodes { id name } } } }
        `, { teamId: conn.teamId }) as { team: { states: { nodes: { id: string; name: string }[] } } }
        const state = teamData.team.states.nodes.find(
          (s) => s.name.toLowerCase() === stateName.toLowerCase()
        )
        if (state) stateId = state.id
      }

      const input: Record<string, unknown> = {}
      if (title) input.title = title
      if (description) input.description = description
      if (priority !== undefined) input.priority = priority
      if (stateId) input.stateId = stateId

      const data = await linearGql(conn.apiKey, `
        mutation($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
            issue { id identifier title url state { name } }
          }
        }
      `, { id: issueId, input }) as { issueUpdate: { success: boolean; issue: unknown } }

      return data.issueUpdate
    },
  })
}

export function searchLinearIssuesTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Search Linear issues by keyword.',
    parameters: z.object({
      connectionId: z.string(),
      query: z.string().describe('Search query'),
      limit: z.number().int().min(1).max(25).default(10),
    }),
    execute: async ({ connectionId, query, limit }) => {
      const conn = await getConn(db, workspaceId, connectionId)
      if (!conn) return { error: 'Linear connection not found' }

      const data = await linearGql(conn.apiKey, `
        query($term: String!, $teamId: String!, $first: Int!) {
          searchIssues(term: $term, filter: { team: { id: { eq: $teamId } } }, first: $first) {
            nodes { id identifier title state { name } priority assignee { name } url }
          }
        }
      `, { term: query, teamId: conn.teamId, first: limit }) as {
        searchIssues: { nodes: unknown[] }
      }
      return { issues: data.searchIssues.nodes }
    },
  })
}
