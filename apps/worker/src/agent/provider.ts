import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import type { LanguageModel, EmbeddingModel } from 'ai'
import { getEnv } from '@coworker/config'

export type ProviderName =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'groq'
  | 'mistral'
  | 'ollama'
  | 'xai'
  | 'cohere'
  | 'deepseek'
  | 'together'
  | 'openrouter'

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
  xai: 'grok-3',
  cohere: 'command-r-plus',
  deepseek: 'deepseek-chat',
  together: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  openrouter: 'anthropic/claude-sonnet-4-5',
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
  // Optional fallback chain: if primary fails, try these in order
  fallback?: ProviderConfig[]
}

/**
 * Parse a "provider:model" string (aisuite-style) into a ProviderConfig.
 * Accepts both "anthropic:claude-sonnet-4-5" and plain "anthropic".
 */
export function parseModelString(modelString: string): ProviderConfig {
  const colonIdx = modelString.indexOf(':')
  if (colonIdx === -1) {
    return { provider: modelString as ProviderName }
  }
  const provider = modelString.slice(0, colonIdx) as ProviderName
  const model = modelString.slice(colonIdx + 1)
  return { provider, model }
}

export function buildLLMProvider(config: ProviderConfig): LLMProvider {
  const env = getEnv()
  const { provider, model } = config
  const chatModelName = model ?? DEFAULT_MODELS[provider]

  let chatModel: LanguageModel
  let embeddingModel: EmbeddingModel<string> | null = null

  // Helper: OpenAI embeddings as a universal fallback when a provider has none
  const openAIEmbedding = (): EmbeddingModel<string> | null => {
    if (!env.OPENAI_API_KEY) return null
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
    return openai.embedding('text-embedding-3-small')
  }

  switch (provider) {
    case 'anthropic': {
      if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
      const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })
      chatModel = anthropic(chatModelName)
      embeddingModel = openAIEmbedding()
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
      embeddingModel = openAIEmbedding()
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
      const ollama = createOpenAI({ baseURL: `${env.OLLAMA_BASE_URL}/v1`, apiKey: 'ollama' })
      chatModel = ollama(chatModelName)
      embeddingModel = ollama.embedding(DEFAULT_EMBEDDING_MODELS.ollama!)
      break
    }

    case 'xai': {
      // xAI (Grok) is OpenAI-compatible
      if (!env.XAI_API_KEY) throw new Error('XAI_API_KEY not configured')
      const xai = createOpenAI({ baseURL: 'https://api.x.ai/v1', apiKey: env.XAI_API_KEY })
      chatModel = xai(chatModelName)
      embeddingModel = openAIEmbedding()
      break
    }

    case 'cohere': {
      // Cohere is OpenAI-compatible via /compatibility endpoint
      if (!env.COHERE_API_KEY) throw new Error('COHERE_API_KEY not configured')
      const cohere = createOpenAI({ baseURL: 'https://api.cohere.com/compatibility/v1', apiKey: env.COHERE_API_KEY })
      chatModel = cohere(chatModelName)
      embeddingModel = openAIEmbedding()
      break
    }

    case 'deepseek': {
      // DeepSeek is OpenAI-compatible
      if (!env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured')
      const deepseek = createOpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: env.DEEPSEEK_API_KEY })
      chatModel = deepseek(chatModelName)
      embeddingModel = openAIEmbedding()
      break
    }

    case 'together': {
      // Together AI is OpenAI-compatible
      if (!env.TOGETHER_API_KEY) throw new Error('TOGETHER_API_KEY not configured')
      const together = createOpenAI({ baseURL: 'https://api.together.xyz/v1', apiKey: env.TOGETHER_API_KEY })
      chatModel = together(chatModelName)
      embeddingModel = openAIEmbedding()
      break
    }

    case 'openrouter': {
      // OpenRouter routes to 200+ models — specify model as "provider/name" (e.g. "anthropic/claude-sonnet-4-5")
      if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured')
      const openrouter = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: env.OPENROUTER_API_KEY })
      chatModel = openrouter(chatModelName)
      embeddingModel = openAIEmbedding()
      break
    }

    default:
      throw new Error(`Unknown provider: ${provider}. Supported: ${Object.keys(DEFAULT_MODELS).join(', ')}`)
  }

  return { chatModel, embeddingModel }
}

/**
 * Build a provider with automatic fallback to the next config if the primary
 * fails at instantiation time (e.g. missing API key). Runtime failures (network,
 * rate limits) are handled by BullMQ retries.
 */
export function buildLLMProviderWithFallback(config: ProviderConfig): LLMProvider {
  const chain = [config, ...(config.fallback ?? [])]
  const errors: string[] = []

  for (const c of chain) {
    try {
      return buildLLMProvider(c)
    } catch (err) {
      errors.push(`${c.provider}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  throw new Error(`All providers in fallback chain failed:\n${errors.map((e) => `  • ${e}`).join('\n')}`)
}

export function detectDefaultProviderName(): ProviderName | undefined {
  const env = getEnv()
  if (env.LLM_PROVIDER) return parseModelString(env.LLM_PROVIDER).provider
  if (env.ANTHROPIC_API_KEY) return 'anthropic'
  if (env.OPENAI_API_KEY) return 'openai'
  if (env.GOOGLE_API_KEY) return 'google'
  if (env.GROQ_API_KEY) return 'groq'
  if (env.MISTRAL_API_KEY) return 'mistral'
  if (env.XAI_API_KEY) return 'xai'
  if (env.COHERE_API_KEY) return 'cohere'
  if (env.DEEPSEEK_API_KEY) return 'deepseek'
  if (env.TOGETHER_API_KEY) return 'together'
  if (env.OPENROUTER_API_KEY) return 'openrouter'
  if (env.OLLAMA_BASE_URL) return 'ollama'
  return undefined
}

function detectDefaultProvider(): ProviderConfig {
  const env = getEnv()

  if (env.LLM_PROVIDER) {
    // Support "provider:model" string in LLM_PROVIDER env var
    const base = parseModelString(env.LLM_PROVIDER)
    if (env.LLM_MODEL) base.model = env.LLM_MODEL
    return base
  }

  // Auto-detect from available keys (priority order)
  if (env.ANTHROPIC_API_KEY) return { provider: 'anthropic' }
  if (env.OPENAI_API_KEY) return { provider: 'openai' }
  if (env.GOOGLE_API_KEY) return { provider: 'google' }
  if (env.GROQ_API_KEY) return { provider: 'groq' }
  if (env.MISTRAL_API_KEY) return { provider: 'mistral' }
  if (env.XAI_API_KEY) return { provider: 'xai' }
  if (env.COHERE_API_KEY) return { provider: 'cohere' }
  if (env.DEEPSEEK_API_KEY) return { provider: 'deepseek' }
  if (env.TOGETHER_API_KEY) return { provider: 'together' }
  if (env.OPENROUTER_API_KEY) return { provider: 'openrouter' }
  if (env.OLLAMA_BASE_URL) return { provider: 'ollama' }

  throw new Error('No LLM provider configured. Set at least one API key in .env')
}

// Global default provider (cached)
let _defaultProvider: LLMProvider | undefined

export function getLLMProvider(config?: ProviderConfig): LLMProvider {
  if (config) {
    return buildLLMProviderWithFallback(config)
  }
  if (!_defaultProvider) {
    _defaultProvider = buildLLMProviderWithFallback(detectDefaultProvider())
  }
  return _defaultProvider
}

export { DEFAULT_MODELS, DEFAULT_EMBEDDING_MODELS }
