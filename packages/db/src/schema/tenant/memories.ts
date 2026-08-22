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

  -- The base migration creates embedding as text; convert it so the vector index works.
  DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'tenant' AND table_name = 'memories'
        AND column_name = 'embedding' AND data_type = 'text'
    ) THEN
      ALTER TABLE tenant.memories
        ALTER COLUMN embedding TYPE vector(1536) USING NULLIF(embedding, '')::vector;
    END IF;
  END $$;

  ALTER TABLE tenant.memories
    ADD COLUMN IF NOT EXISTS embedding vector(1536);

  CREATE INDEX IF NOT EXISTS memories_embedding_idx
    ON tenant.memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
`
