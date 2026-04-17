import { tool } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { files } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import type { DbClient } from '@coworker/db'

export function listFilesTool(db: DbClient, workspaceId: string) {
  return tool({
    description:
      'List files that have been uploaded to this workspace. Use this when the user asks about uploaded documents or files.',
    parameters: z.object({
      limit: z.number().min(1).max(50).default(20).describe('Maximum number of files to return'),
    }),
    execute: async ({ limit }) => {
      const fileList = await withWorkspace(db, workspaceId, async (tx) =>
        tx.query.files.findMany({
          where: eq(files.workspaceId, workspaceId),
          orderBy: (f, { desc }) => [desc(f.createdAt)],
          limit,
          columns: { id: true, name: true, mimeType: true, sizeBytes: true, createdAt: true },
        })
      )

      if (fileList.length === 0) {
        return { files: [], message: 'No files have been uploaded to this workspace yet.' }
      }

      return {
        files: fileList.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.mimeType ?? 'unknown',
          size: formatBytes(f.sizeBytes ?? 0),
          uploadedAt: f.createdAt,
        })),
      }
    },
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
