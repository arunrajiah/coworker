import { generateText } from 'ai'
import type { DbClient } from '@coworker/db'
import { getLLMProvider } from '../agent/provider.js'
import { saveMemory } from '../agent/memory.js'

const VISION_PROMPT =
  'Describe this image in detail, including any text, diagrams, charts, data, or visual elements that could be relevant for business use. Be thorough and specific.'

export async function extractImage(
  db: DbClient,
  workspaceId: string,
  fileId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ description: string }> {
  const { chatModel } = getLLMProvider()

  const base64 = buffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64}`

  const { text: description } = await generateText({
    model: chatModel,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: dataUrl },
          { type: 'text', text: VISION_PROMPT },
        ],
      },
    ],
  })

  await saveMemory(db, workspaceId, `Image: ${fileName}\n\n${description}`, 'file', fileId, {
    fileName,
    isImage: true,
  })

  return { description }
}
