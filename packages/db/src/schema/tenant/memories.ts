import { uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'

export const memories = tenantSchema.table(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    content: text('content').notNull(),
    // pgvector column added via raw SQL in migrate.ts (Drizzle doesn't natively type vector columns)
    embedding: text('embedding'),
    sourceType: text('source_type').notNull().default('message'),
    sourceId: uuid('source_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('memories_workspace_idx').on(t.workspaceId),
  })
)

export type Memory = typeof memories.$inferSelect
export type NewMemory = typeof memories.$inferInsert

export const VECTOR_SETUP_SQL = `
  CREATE EXTENSION IF NOT EXISTS vector;

  ALTER TABLE tenant.memories
    ADD COLUMN IF NOT EXISTS embedding vector(1536);

  CREATE INDEX IF NOT EXISTS memories_embedding_idx
    ON tenant.memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
`
