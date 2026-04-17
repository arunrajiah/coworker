import { tool } from 'ai'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { vercelConnections } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { VercelAdapter } from '@coworker/adapter-vercel'

export function listVercelConnectionsTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List all Vercel project connections for this workspace.',
    parameters: z.object({}),
    execute: async () => {
      const connections = await db.query.vercelConnections.findMany({
        where: eq(vercelConnections.workspaceId, workspaceId),
        columns: { accessToken: false },
      })
      return { connections }
    },
  })
}

export function listDeploymentsTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'List recent deployments for a connected Vercel project.',
    parameters: z.object({
      connectionId: z.string().describe('The Vercel connection ID'),
      limit: z.number().int().min(1).max(50).optional().default(10),
    }),
    execute: async ({ connectionId, limit }) => {
      const conn = await db.query.vercelConnections.findFirst({
        where: and(eq(vercelConnections.id, connectionId), eq(vercelConnections.workspaceId, workspaceId)),
      })
      if (!conn) return { error: 'Vercel connection not found' }

      const adapter = new VercelAdapter(conn.accessToken, conn.teamId ?? undefined)
      const deployments = await adapter.listDeployments(conn.projectId, limit)
      return {
        project: conn.projectName,
        deployments: deployments.map((d) => ({
          id: d.uid,
          url: d.url,
          state: d.state,
          target: d.target,
          createdAt: new Date(d.createdAt).toISOString(),
        })),
      }
    },
  })
}

export function triggerDeploymentTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Trigger a new deployment for a connected Vercel project.',
    parameters: z.object({
      connectionId: z.string().describe('The Vercel connection ID'),
      target: z.enum(['production', 'staging']).optional().default('production'),
    }),
    execute: async ({ connectionId, target }) => {
      const conn = await db.query.vercelConnections.findFirst({
        where: and(eq(vercelConnections.id, connectionId), eq(vercelConnections.workspaceId, workspaceId)),
      })
      if (!conn) return { error: 'Vercel connection not found' }

      const adapter = new VercelAdapter(conn.accessToken, conn.teamId ?? undefined)
      const deployment = await adapter.triggerDeployment(conn.projectId, target)
      return {
        id: deployment.uid,
        url: deployment.url,
        state: deployment.state,
        target: deployment.target,
      }
    },
  })
}

export function getDeploymentStatusTool(db: DbClient, workspaceId: string) {
  return tool({
    description: 'Get the status of a specific Vercel deployment.',
    parameters: z.object({
      connectionId: z.string().describe('The Vercel connection ID'),
      deploymentId: z.string().describe('The deployment UID'),
    }),
    execute: async ({ connectionId, deploymentId }) => {
      const conn = await db.query.vercelConnections.findFirst({
        where: and(eq(vercelConnections.id, connectionId), eq(vercelConnections.workspaceId, workspaceId)),
      })
      if (!conn) return { error: 'Vercel connection not found' }

      const adapter = new VercelAdapter(conn.accessToken, conn.teamId ?? undefined)
      const deployment = await adapter.getDeployment(deploymentId)
      return {
        id: deployment.uid,
        url: deployment.url,
        state: deployment.state,
        target: deployment.target,
        createdAt: new Date(deployment.createdAt).toISOString(),
        readyAt: deployment.ready ? new Date(deployment.ready).toISOString() : null,
      }
    },
  })
}
