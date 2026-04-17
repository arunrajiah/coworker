import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel, EmbeddingModel } from 'ai'
import { getEnv } from '@coworker/config'

export interface LLMProvider {
  chatModel: LanguageModel
  embeddingModel: EmbeddingModel<string>
}

let _provider: LLMProvider | undefined

export function getLLMProvider(): LLMProvider {
  if (_provider) return _provider

  const env = getEnv()

  if (env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })
    // Use OpenAI for embeddings even when using Anthropic for chat (Anthropic has no embedding API)
    const openai = env.OPENAI_API_KEY ? createOpenAI({ apiKey: env.OPENAI_API_KEY }) : null
    _provider = {
      chatModel: anthropic('claude-sonnet-4-5'),
      embeddingModel: openai
        ? openai.embedding('text-embedding-3-small')
        : (null as any), // embeddings disabled without OpenAI key
    }
  } else if (env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
    _provider = {
      chatModel: openai('gpt-4o'),
      embeddingModel: openai.embedding('text-embedding-3-small'),
    }
  } else {
    throw new Error('No LLM API key configured')
  }

  return _provider
}
