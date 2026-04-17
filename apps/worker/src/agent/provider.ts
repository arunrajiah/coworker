import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import type { LanguageModel, EmbeddingModel } from 'ai'
import { getEnv } from '@coworker/config'

export type ProviderName = 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral' | 'ollama'

export interface LLMProvider {
  chatModel: LanguageModel
  embeddingModel: EmbeddingModel<string> | null
}

// Default models per provider
const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o',
  google: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  mistral: 'mistral-large-latest',
  ollama: 'llama3.2',
}

// Default embedding models per provider (null = no native support)
const DEFAULT_EMBEDDING_MODELS: Partial<Record<ProviderName, string>> = {
  openai: 'text-embedding-3-small',
  google: 'text-embedding-004',
  mistral: 'mistral-embed',
  ollama: 'nomic-embed-text',
}

export interface ProviderConfig {
  provider: ProviderName
  model?: string
}

export function buildLLMProvider(config: ProviderConfig): LLMProvider {
  const env = getEnv()
  const { provider, model } = config
  const chatModelName = model ?? DEFAULT_MODELS[provider]

  let chatModel: LanguageModel
  let embeddingModel: EmbeddingModel<string> | null = null

  switch (provider) {
    case 'anthropic': {
      if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
      const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })
      chatModel = anthropic(chatModelName)
      // Anthropic has no embedding API — fall back to OpenAI if available
      if (env.OPENAI_API_KEY) {
        const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
        embeddingModel = openai.embedding('text-embedding-3-small')
      }
      break
    }

    case 'openai': {
      if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')
      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
      chatModel = openai(chatModelName)
      embeddingModel = openai.embedding('text-embedding-3-small')
      break
    }

    case 'google': {
      if (!env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY not configured')
      const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_API_KEY })
      chatModel = google(chatModelName)
      embeddingModel = google.textEmbeddingModel(DEFAULT_EMBEDDING_MODELS.google!)
      break
    }

    case 'groq': {
      if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured')
      const groq = createGroq({ apiKey: env.GROQ_API_KEY })
      chatModel = groq(chatModelName)
      // Groq has no embedding API — fall back to OpenAI if available
      if (env.OPENAI_API_KEY) {
        const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
        embeddingModel = openai.embedding('text-embedding-3-small')
      }
      break
    }

    case 'mistral': {
      if (!env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY not configured')
      const mistral = createMistral({ apiKey: env.MISTRAL_API_KEY })
      chatModel = mistral(chatModelName)
      embeddingModel = mistral.textEmbeddingModel(DEFAULT_EMBEDDING_MODELS.mistral!)
      break
    }

    case 'ollama': {
      if (!env.OLLAMA_BASE_URL) throw new Error('OLLAMA_BASE_URL not configured')
      // Ollama is OpenAI-compatible
      const ollama = createOpenAI({ baseURL: `${env.OLLAMA_BASE_URL}/v1`, apiKey: 'ollama' })
      chatModel = ollama(chatModelName)
      // Try nomic-embed-text for embeddings; if unavailable, falls back to null
      embeddingModel = ollama.embedding(DEFAULT_EMBEDDING_MODELS.ollama!)
      break
    }

    default:
      throw new Error(`Unknown provider: ${provider}`)
  }

  return { chatModel, embeddingModel }
}

function detectDefaultProvider(): ProviderConfig {
  const env = getEnv()

  // Explicit override takes highest priority
  if (env.LLM_PROVIDER) {
    return { provider: env.LLM_PROVIDER, model: env.LLM_MODEL }
  }

  // Auto-detect from available keys (priority order)
  if (env.ANTHROPIC_API_KEY) return { provider: 'anthropic' }
  if (env.OPENAI_API_KEY) return { provider: 'openai' }
  if (env.GOOGLE_API_KEY) return { provider: 'google' }
  if (env.GROQ_API_KEY) return { provider: 'groq' }
  if (env.MISTRAL_API_KEY) return { provider: 'mistral' }
  if (env.OLLAMA_BASE_URL) return { provider: 'ollama' }

  throw new Error('No LLM provider configured')
}

// Global default provider (cached)
let _defaultProvider: LLMProvider | undefined

export function getLLMProvider(config?: ProviderConfig): LLMProvider {
  if (config) {
    return buildLLMProvider(config)
  }
  if (!_defaultProvider) {
    _defaultProvider = buildLLMProvider(detectDefaultProvider())
  }
  return _defaultProvider
}

export { DEFAULT_MODELS, DEFAULT_EMBEDDING_MODELS }
