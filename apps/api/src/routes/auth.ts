import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, gt } from 'drizzle-orm'
import { users, sessions, magicLinks } from '@coworker/db'
import { getContainer } from '../container.js'
import { signToken, generateMagicToken } from '../lib/auth.js'
import { nanoid } from 'nanoid'

export const authRoutes = new Hono()

// Send magic link
authRoutes.post(
  '/magic-link/send',
  zValidator('json', z.object({ email: z.string().email() })),
  async (c) => {
    const { email } = c.req.valid('json')
    const { db, email: emailProvider } = getContainer()

    // Upsert user
    let user = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (!user) {
      const [created] = await db.insert(users).values({ email }).returning()
      user = created
    }

    const token = generateMagicToken()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 min

    await db.insert(magicLinks).values({ email, token, expiresAt })

    const magicUrl = `${process.env.APP_URL}/auth/verify?token=${token}`

    await emailProvider.send({
      to: { email },
      subject: 'Sign in to Coworker',
      html: `<p>Click <a href="${magicUrl}">here</a> to sign in. Link expires in 15 minutes.</p>`,
      text: `Sign in: ${magicUrl}`,
    })

    return c.json({ ok: true })
  }
)

// Verify magic link token
authRoutes.post(
  '/magic-link/verify',
  zValidator('json', z.object({ token: z.string() })),
  async (c) => {
    const { token } = c.req.valid('json')
    const { db } = getContainer()

    const link = await db.query.magicLinks.findFirst({
      where: and(
        eq(magicLinks.token, token),
        gt(magicLinks.expiresAt, new Date())
      ),
    })

    if (!link || link.usedAt) {
      return c.json({ error: 'Invalid or expired link' }, 400)
    }

    // Mark used
    await db
      .update(magicLinks)
      .set({ usedAt: new Date() })
      .where(eq(magicLinks.token, token))

    // Ensure user exists
    let user = await db.query.users.findFirst({ where: eq(users.email, link.email) })
    if (!user) {
      const [created] = await db.insert(users).values({ email: link.email, emailVerified: true }).returning()
      user = created
    } else if (!user.emailVerified) {
      await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id))
    }

    // Create session
    const sessionToken = await signToken({ sub: user.id, email: user.email })
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    await db.insert(sessions).values({ userId: user.id, token: sessionToken, expiresAt })

    return c.json({ token: sessionToken, user: { id: user.id, email: user.email, name: user.name } })
  }
)

// Get current user
authRoutes.get('/me', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const { db } = getContainer()
  const session = await db.query.sessions.findFirst({ where: eq(sessions.token, token) })
  if (!session || session.expiresAt < new Date()) return c.json({ error: 'Unauthorized' }, 401)

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl })
})

// Sign out
authRoutes.post('/signout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (token) {
    const { db } = getContainer()
    await db.delete(sessions).where(eq(sessions.token, token))
  }
  return c.json({ ok: true })
})
