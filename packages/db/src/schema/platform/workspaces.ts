import { uuid, text, timestamp, pgEnum, primaryKey } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { platformSchema } from './_schema'
import { users } from './users'

export const templateTypeEnum = pgEnum('template_type', [
  'saas',
  'agency',
  'ecommerce',
  'consulting',
  'freelancer',
  'general',
])

export const workspaceMemberRoleEnum = pgEnum('workspace_member_role', ['owner', 'admin', 'member'])

export const llmProviderEnum = pgEnum('llm_provider', [
  'anthropic',
  'openai',
  'google',
  'groq',
  'mistral',
  'ollama',
])

export const workspaces = platformSchema.table('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  templateType: templateTypeEnum('template_type').notNull().default('general'),
  llmProvider: llmProviderEnum('llm_provider'),
  llmModel: text('llm_model'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workspaceMembers = platformSchema.table(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceMemberRoleEnum('role').notNull().default('member'),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.workspaceId, t.userId] }) })
)

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
}))

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}))

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type WorkspaceMember = typeof workspaceMembers.$inferSelect
