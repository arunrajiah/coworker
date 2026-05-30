import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, ne } from 'drizzle-orm'
import { workspaces, workspaceMembers, workspaceInvitations, users, skills, autopilotRules } from '@coworker/db'
import { FOUNDER_TEMPLATES } from '@coworker/core'
import { getContainer } from '../container.js'
import { authMiddleware } from '../middleware/auth.js'
import { workspaceMiddleware } from '../middleware/workspace.js'
import slugify from 'slug'
import { nanoid } from 'nanoid'

export const workspaceRoutes = new Hono()

workspaceRoutes.use('*', authMiddleware)

// List my workspaces
workspaceRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { db } = getContainer()

  const memberships = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.userId, user.sub),
    with: { workspace: true },
  })

  return c.json(memberships.map((m) => ({ ...(m.workspace as object), role: m.role })))
})

// Create workspace
workspaceRoutes.post(
  '/',
  zValidator(
    'json',
    z.object({
      name: z.string().min(2).max(64),
      templateType: z
        .enum(['saas', 'agency', 'ecommerce', 'consulting', 'freelancer', 'creator', 'real_estate', 'general'])
        .default('general'),
    })
  ),
  async (c) => {
    const user = c.get('user')
    const { name, templateType } = c.req.valid('json')
    const { db } = getContainer()

    const baseSlug = slugify(name)
    let slug = baseSlug
    let attempt = 0
    while (await db.query.workspaces.findFirst({ where: eq(workspaces.slug, slug) })) {
      slug = `${baseSlug}-${++attempt}`
    }

    const [workspace] = await db
      .insert(workspaces)
      .values({ name, slug, ownerId: user.sub, templateType })
      .returning()

    // Add owner as member
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.sub,
      role: 'owner',
      joinedAt: new Date(),
    })

    // Seed template defaults
    const template = FOUNDER_TEMPLATES[templateType]
    if (template.defaultSkills.length > 0) {
      await db.insert(skills).values(
        template.defaultSkills.map((s) => ({
          workspaceId: workspace.id,
          createdBy: user.sub,
          name: s.name,
          description: s.description,
          prompt: s.prompt,
          triggerPhrase: s.triggerPhrase ?? null,
          tools: s.tools,
        }))
      )
    }
    if (template.defaultAutopilotRules.length > 0) {
      await db.insert(autopilotRules).values(
        template.defaultAutopilotRules.map((r) => ({
          workspaceId: workspace.id,
          createdBy: user.sub,
          name: r.name,
          description: r.description ?? null,
          triggerType: r.triggerType,
          triggerConfig: r.triggerConfig,
          actionType: r.actionType,
          actionConfig: r.actionConfig,
        }))
      )
    }

    return c.json({ ...workspace, role: 'owner' }, 201)
  }
)

// Get workspace
workspaceRoutes.get('/:slug', async (c) => {
  const { db } = getContainer()
  const slug = c.req.param('slug')
  const user = c.get('user')

  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.slug, slug) })
  if (!ws) return c.json({ error: 'Not found' }, 404)

  const membership = await db.query.workspaceMembers.findFirst({
    where: and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, user.sub)),
  })
  if (!membership) return c.json({ error: 'Forbidden' }, 403)

  return c.json({ ...ws, role: membership.role })
})

// Update workspace settings (name, llmProvider, llmModel)
workspaceRoutes.patch(
  '/:slug',
  zValidator(
    'json',
    z.object({
      name: z.string().min(2).max(64).optional(),
      llmProvider: z
        .enum(['anthropic', 'openai', 'google', 'groq', 'mistral', 'ollama'])
        .nullable()
        .optional(),
      llmModel: z.string().max(128).nullable().optional(),
    })
  ),
  async (c) => {
    const { db } = getContainer()
    const slug = c.req.param('slug')
    const user = c.get('user')
    const body = c.req.valid('json')

    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.slug, slug) })
    if (!ws) return c.json({ error: 'Not found' }, 404)

    const membership = await db.query.workspaceMembers.findFirst({
      where: and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, user.sub)),
    })
    if (!membership) return c.json({ error: 'Forbidden' }, 403)
    if (membership.role === 'member') return c.json({ error: 'Insufficient permissions' }, 403)

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.name !== undefined) updates.name = body.name
    if (body.llmProvider !== undefined) updates.llmProvider = body.llmProvider
    if (body.llmModel !== undefined) updates.llmModel = body.llmModel

    const [updated] = await db
      .update(workspaces)
      .set(updates)
      .where(eq(workspaces.id, ws.id))
      .returning()

    return c.json({ ...updated, role: membership.role })
  }
)

// ── Member management ─────────────────────────────────────────────────────────
// All routes below require workspace membership (workspaceMiddleware applied per-route)

// List members
workspaceRoutes.get('/:slug/members', authMiddleware, workspaceMiddleware, async (c) => {
  const workspaceId = c.get('workspaceId')
  const { db } = getContainer()

  const members = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.workspaceId, workspaceId),
    with: { user: true },
  })

  return c.json(
    members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      email: (m.user as { email: string }).email,
      name: (m.user as { name: string | null }).name,
      avatarUrl: (m.user as { avatarUrl: string | null }).avatarUrl,
    }))
  )
})

// Update member role
workspaceRoutes.patch(
  '/:slug/members/:userId',
  authMiddleware,
  workspaceMiddleware,
  zValidator('json', z.object({ role: z.enum(['admin', 'member']) })),
  async (c) => {
    const workspaceId = c.get('workspaceId')
    const user = c.get('user')
    const targetUserId = c.req.param('userId') ?? ''
    const { role } = c.req.valid('json')
    const { db } = getContainer()
    if (!targetUserId) return c.json({ error: 'Missing userId' }, 400)

    // Only owner/admin can change roles
    const myMembership = await db.query.workspaceMembers.findFirst({
      where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.sub)),
    })
    if (!myMembership || myMembership.role === 'member') {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }
    // Can't change the owner's role
    const target = await db.query.workspaceMembers.findFirst({
      where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)),
    })
    if (!target) return c.json({ error: 'Member not found' }, 404)
    if (target.role === 'owner') return c.json({ error: 'Cannot change the owner role' }, 400)

    await db
      .update(workspaceMembers)
      .set({ role })
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)))

    return c.json({ ok: true, role })
  }
)

// Remove a member
workspaceRoutes.delete('/:slug/members/:userId', authMiddleware, workspaceMiddleware, async (c) => {
  const workspaceId = c.get('workspaceId')
  const user = c.get('user')
  const targetUserId = c.req.param('userId') ?? ''
  const { db } = getContainer()
  if (!targetUserId) return c.json({ error: 'Missing userId' }, 400)

  const myMembership = await db.query.workspaceMembers.findFirst({
    where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.sub)),
  })
  // Can remove yourself (leave), or owner/admin can remove others
  const isSelf = targetUserId === user.sub
  if (!isSelf && (!myMembership || myMembership.role === 'member')) {
    return c.json({ error: 'Insufficient permissions' }, 403)
  }

  const target = await db.query.workspaceMembers.findFirst({
    where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)),
  })
  if (!target) return c.json({ error: 'Member not found' }, 404)
  if (target.role === 'owner') return c.json({ error: 'Cannot remove the workspace owner' }, 400)

  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)))

  return c.json({ ok: true })
})

// ── Invitations ───────────────────────────────────────────────────────────────

// Invite a user by email
workspaceRoutes.post(
  '/:slug/members/invite',
  authMiddleware,
  workspaceMiddleware,
  zValidator('json', z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'member']).default('member'),
  })),
  async (c) => {
    const workspaceId = c.get('workspaceId')
    const user = c.get('user')
    const { email, role } = c.req.valid('json')
    const { db } = getContainer()

    // Only owner/admin can invite
    const myMembership = await db.query.workspaceMembers.findFirst({
      where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.sub)),
    })
    if (!myMembership || myMembership.role === 'member') {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    // Check if already a member
    const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (existingUser) {
      const alreadyMember = await db.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, existingUser.id)
        ),
      })
      if (alreadyMember) return c.json({ error: 'User is already a member' }, 409)
    }

    // Revoke any existing pending invite for this email
    await db
      .delete(workspaceInvitations)
      .where(and(eq(workspaceInvitations.workspaceId, workspaceId), eq(workspaceInvitations.email, email)))

    const token = nanoid(32)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const [invitation] = await db
      .insert(workspaceInvitations)
      .values({ workspaceId, invitedBy: user.sub, email, role, token, expiresAt })
      .returning()

    // Get workspace name for the invite link
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })

    // Email the invitation (if email adapter is configured; otherwise log)
    const inviteUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/invite/${token}`
    console.log(`[invite] ${email} invited to ${ws?.name} — ${inviteUrl}`)

    // TODO: send email via adapter when SMTP is configured

    return c.json({ id: invitation.id, email, role, inviteUrl, expiresAt: invitation.expiresAt })
  }
)

// List pending invitations
workspaceRoutes.get('/:slug/members/invitations', authMiddleware, workspaceMiddleware, async (c) => {
  const workspaceId = c.get('workspaceId')
  const user = c.get('user')
  const { db } = getContainer()

  const myMembership = await db.query.workspaceMembers.findFirst({
    where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.sub)),
  })
  if (!myMembership || myMembership.role === 'member') {
    return c.json({ error: 'Insufficient permissions' }, 403)
  }

  const now = new Date()
  const invitations = await db.query.workspaceInvitations.findMany({
    where: and(
      eq(workspaceInvitations.workspaceId, workspaceId),
      // only pending (not accepted, not expired)
    ),
  })

  return c.json(
    invitations
      .filter((inv) => !inv.acceptedAt && inv.expiresAt > now)
      .map((inv) => ({ id: inv.id, email: inv.email, role: inv.role, expiresAt: inv.expiresAt, createdAt: inv.createdAt }))
  )
})

// Revoke invitation
workspaceRoutes.delete('/:slug/members/invitations/:invitationId', authMiddleware, workspaceMiddleware, async (c) => {
  const workspaceId = c.get('workspaceId')
  const invitationId = c.req.param('invitationId') ?? ''
  const { db } = getContainer()
  if (!invitationId) return c.json({ error: 'Missing invitationId' }, 400)

  await db
    .delete(workspaceInvitations)
    .where(and(eq(workspaceInvitations.id, invitationId), eq(workspaceInvitations.workspaceId, workspaceId)))

  return c.json({ ok: true })
})

// ── Public invitation acceptance (no auth required to view, auth required to accept) ──

// Get invitation details (public)
workspaceRoutes.get('/invitations/:token', async (c) => {
  const token = c.req.param('token') ?? ''
  const { db } = getContainer()
  if (!token) return c.json({ error: 'Missing token' }, 400)

  const invitation = await db.query.workspaceInvitations.findFirst({
    where: eq(workspaceInvitations.token, token),
    with: { workspace: true },
  })

  if (!invitation) return c.json({ error: 'Invitation not found' }, 404)
  if (invitation.acceptedAt) return c.json({ error: 'Invitation already used' }, 410)
  if (invitation.expiresAt < new Date()) return c.json({ error: 'Invitation expired' }, 410)

  return c.json({
    email: invitation.email,
    role: invitation.role,
    workspaceName: (invitation.workspace as { name: string }).name,
    workspaceSlug: (invitation.workspace as { slug: string }).slug,
    expiresAt: invitation.expiresAt,
  })
})

// Accept invitation (requires auth)
workspaceRoutes.post('/invitations/:token/accept', authMiddleware, async (c) => {
  const token = c.req.param('token') ?? ''
  const user = c.get('user')
  const { db } = getContainer()
  if (!token) return c.json({ error: 'Missing token' }, 400)

  const invitation = await db.query.workspaceInvitations.findFirst({
    where: eq(workspaceInvitations.token, token),
    with: { workspace: true },
  })

  if (!invitation) return c.json({ error: 'Invitation not found' }, 404)
  if (invitation.acceptedAt) return c.json({ error: 'Invitation already used' }, 410)
  if (invitation.expiresAt < new Date()) return c.json({ error: 'Invitation expired' }, 410)

  // Check the logged-in user's email matches the invite
  const currentUser = await db.query.users.findFirst({ where: eq(users.id, user.sub) })
  if (!currentUser) return c.json({ error: 'User not found' }, 404)
  if (currentUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return c.json({ error: `This invitation was sent to ${invitation.email}` }, 403)
  }

  // Check not already a member
  const alreadyMember = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, invitation.workspaceId),
      eq(workspaceMembers.userId, user.sub)
    ),
  })
  if (alreadyMember) {
    await db
      .update(workspaceInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(workspaceInvitations.id, invitation.id))
    return c.json({ workspaceSlug: (invitation.workspace as { slug: string }).slug })
  }

  // Add as member
  await db.insert(workspaceMembers).values({
    workspaceId: invitation.workspaceId,
    userId: user.sub,
    role: invitation.role,
    joinedAt: new Date(),
  })

  // Mark invitation as accepted
  await db
    .update(workspaceInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(workspaceInvitations.id, invitation.id))

  return c.json({ workspaceSlug: (invitation.workspace as { slug: string }).slug })
})
