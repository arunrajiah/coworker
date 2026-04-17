import { tool } from 'ai'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import type { DbClient } from '@coworker/db'

export function readFileTool(db: DbClient, workspaceId: string) {
  return tool({
    description:
      'Read the extracted text content of an uploaded file. Use this when the user asks about the contents of a specific file or when you need to analyze a document.',
    parameters: z.object({
      fileId: z.string().describe('The ID of the file to read'),
    }),
    execute: async ({ fileId }) => {
      const chunks = await db.execute(
        sql`SELECT content, metadata FROM tenant.memories WHERE workspace_id = ${workspaceId}::uuid AND source_type = 'file' AND source_id = ${fileId}::uuid ORDER BY (metadata->>'chunkIndex')::int NULLS LAST LIMIT 50`
      )

      const rows = chunks as any[]
      if (rows.length === 0) {
        return {
          fileId,
          content: null,
          message: 'No extracted content found for this file. It may still be processing or extraction may have failed.',
        }
      }

      const content = rows.map((r: any) => r.content as string).join('\n\n')
      const metadata = rows[0]?.metadata as Record<string, unknown> | null

      return {
        fileId,
        fileName: metadata?.fileName ?? 'unknown',
        chunkCount: rows.length,
        content,
      }
    },
  })
}
