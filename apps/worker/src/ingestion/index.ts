import { eq } from 'drizzle-orm'
import { files } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import type { Redis } from 'ioredis'
import { LocalFileStorage } from '@coworker/adapter-storage-local'
import { getEnv } from '@coworker/config'
import { extractPdf } from './pdf.js'
import { extractImage } from './image.js'

export interface FileIngestionJobData {
  workspaceId: string
  fileId: string
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])

export async function processFile(
  db: DbClient,
  redis: Redis,
  data: FileIngestionJobData
): Promise<void> {
  const { workspaceId, fileId } = data
  const env = getEnv()

  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) })
  if (!file) throw new Error(`File ${fileId} not found`)

  const publish = (status: string) =>
    redis.publish(
      `ws:${workspaceId}`,
      JSON.stringify({ type: 'file:extraction_status', fileId, status, workspaceId })
    )

  await withWorkspace(db, workspaceId, async (tx) =>
    tx.update(files).set({ extractionStatus: 'processing' }).where(eq(files.id, fileId))
  )
  await publish('processing')

  try {
    const storage = new LocalFileStorage(env.UPLOAD_DIR ?? './uploads', env.API_URL ?? 'http://localhost:3001')
    const buffer = await storage.download(file.storageKey)
    const mimeType = file.mimeType ?? ''

    if (mimeType === 'application/pdf') {
      await extractPdf(db, workspaceId, fileId, file.name, buffer)
    } else if (IMAGE_TYPES.has(mimeType)) {
      await extractImage(db, workspaceId, fileId, file.name, buffer, mimeType)
    } else {
      // Plain text files: treat the raw content as a single chunk
      const text = buffer.toString('utf-8').slice(0, 50000)
      if (text.trim()) {
        const { saveMemory } = await import('../agent/memory.js')
        await saveMemory(db, workspaceId, text, 'file', fileId, { fileName: file.name })
      }
    }

    await withWorkspace(db, workspaceId, async (tx) =>
      tx
        .update(files)
        .set({ extractionStatus: 'extracted', extractedAt: new Date() })
        .where(eq(files.id, fileId))
    )
    await publish('extracted')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[ingestion] File ${fileId} failed:`, errorMessage)

    await withWorkspace(db, workspaceId, async (tx) =>
      tx.update(files).set({ extractionStatus: 'failed' }).where(eq(files.id, fileId))
    )
    await publish('failed')

    throw err
  }
}
