import type { Context, Next } from 'hono'
import { getContainer } from '../container.js'
import { eq, and } from 'drizzle-orm'
import { workspaces, workspaceMembers } from '@coworker/db'

declare module 'hono' {
  interface ContextVariableMap {
    workspaceId: string
    workspaceSlug: string
  }
}

// Cache slug → UUID to avoid a DB hit on every request (slug is immutable)
const slugCache = new Map<string, { id: string; expiresAt: number }>()

export async function workspaceMiddleware(c: Context, next: Next) {
  const slug = c.req.param('workspaceSlug') ?? c.req.header('X-Workspace-Slug')
  if (!slug) return c.json({ error: 'Workspace slug required' }, 400)

  const user = c.get('user')
  const { db } = getContainer()

  // Resolve slug → id (cached)
  let workspaceId: string
  const cached = slugCache.get(slug)
  if (cached && cached.expiresAt > Date.now()) {
    workspaceId = cached.id
  } else {
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.slug, slug) })
    if (!ws) return c.json({ error: 'Workspace not found' }, 404)
    workspaceId = ws.id
    slugCache.set(slug, { id: workspaceId, expiresAt: Date.now() + 5 * 60 * 1000 })
  }

  // Verify user is a member
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, user.sub)
    ),
  })
  if (!membership) return c.json({ error: 'Forbidden' }, 403)

  c.set('workspaceId', workspaceId)
  c.set('workspaceSlug', slug)
  await next()
}
