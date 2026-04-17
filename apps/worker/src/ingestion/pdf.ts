import { createRequire } from 'module'
import type { DbClient } from '@coworker/db'
import { saveMemory } from '../agent/memory.js'

const require = createRequire(import.meta.url)

const CHUNK_SIZE = 2000  // characters (~500 tokens at 4 chars/token)
const CHUNK_OVERLAP = 200
const MAX_CHUNKS = 100

function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length && chunks.length < MAX_CHUNKS) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end))
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks
}

export async function extractPdf(
  db: DbClient,
  workspaceId: string,
  fileId: string,
  fileName: string,
  buffer: Buffer
): Promise<{ chunkCount: number }> {
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const { text } = await pdfParse(buffer)

  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return { chunkCount: 0 }

  const chunks = chunkText(cleaned)
  const totalChunks = chunks.length

  for (let i = 0; i < chunks.length; i++) {
    await saveMemory(db, workspaceId, chunks[i], 'file', fileId, {
      chunkIndex: i,
      totalChunks,
      fileName,
      truncated: chunks.length === MAX_CHUNKS && i === MAX_CHUNKS - 1,
    })
  }

  return { chunkCount: totalChunks }
}
