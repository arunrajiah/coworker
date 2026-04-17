import type { Context, Next } from 'hono'
import { verifyToken, type JwtPayload } from '../lib/auth.js'
import { getContainer } from '../container.js'
import { eq } from 'drizzle-orm'
import { sessions } from '@coworker/db'

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = await verifyToken(token)

    // Verify session still exists in DB
    const { db } = getContainer()
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.token, token),
    })

    if (!session || session.expiresAt < new Date()) {
      return c.json({ error: 'Session expired' }, 401)
    }

    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
}
