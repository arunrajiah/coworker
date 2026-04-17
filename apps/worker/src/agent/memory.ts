import { sql, eq, desc } from 'drizzle-orm'
import { memories } from '@coworker/db'
import type { DbClient } from '@coworker/db'
import { withWorkspace } from '@coworker/db'
import { embed } from 'ai'
import { getLLMProvider } from './provider.js'

export async function retrieveRelevantMemories(
  db: DbClient,
  workspaceId: string,
  query: string,
  limit = 5
): Promise<string[]> {
  try {
    const { embeddingModel } = getLLMProvider()
    const { embedding } = await embed({ model: embeddingModel, value: query })
    const vectorStr = `[${embedding.join(',')}]`

    // Raw SQL for pgvector similarity search
    const results = await db.execute(
      sql`
        SELECT content
        FROM tenant.memories
        WHERE workspace_id = ${workspaceId}::uuid
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${limit}
      `
    )

    return (results as any[]).map((r: any) => r.content as string)
  } catch {
    // Fall back to recent memories if vector search fails (e.g., no embedding configured)
    const result = await withWorkspace(db, workspaceId, async (tx) =>
      tx.query.memories.findMany({
        where: eq(memories.workspaceId, workspaceId),
        orderBy: [desc(memories.createdAt)],
        limit,
        columns: { content: true },
      })
    )
    return result.map((m) => m.content)
  }
}

export async function saveMemory(
  db: DbClient,
  workspaceId: string,
  content: string,
  sourceType: string,
  sourceId?: string
): Promise<void> {
  try {
    const { embeddingModel } = getLLMProvider()
    const { embedding } = await embed({ model: embeddingModel, value: content })
    const vectorStr = `[${embedding.join(',')}]`

    await db.execute(
      sql`
        INSERT INTO tenant.memories (id, workspace_id, content, embedding, source_type, source_id)
        VALUES (gen_random_uuid(), ${workspaceId}::uuid, ${content}, ${vectorStr}::vector, ${sourceType}, ${sourceId ?? null}::uuid)
      `
    )
  } catch {
    // Save without embedding if vector fails
    await withWorkspace(db, workspaceId, async (tx) =>
      tx.insert(memories).values({
        workspaceId,
        content,
        sourceType,
        sourceId: sourceId ?? null,
      })
    )
  }
}
