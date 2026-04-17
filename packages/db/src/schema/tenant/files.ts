import { uuid, text, timestamp, bigint } from 'drizzle-orm/pg-core'
import { tenantSchema } from './_schema'

export const files = tenantSchema.table('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  name: text('name').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  storageKey: text('storage_key').notNull(),
  storageBackend: text('storage_backend').notNull().default('local'),
  uploadedBy: uuid('uploaded_by').notNull(),
  extractionStatus: text('extraction_status').notNull().default('pending'),
  extractedAt: timestamp('extracted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type File = typeof files.$inferSelect
export type NewFile = typeof files.$inferInsert
