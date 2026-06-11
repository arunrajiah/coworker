import { Hono } from 'hono'
import { getEnv } from '@coworker/config'
import { authMiddleware } from '../middleware/auth.js'

export const providerRoutes = new Hono()

providerRoutes.use('*', authMiddleware)

// Returns which providers have their API key configured on the server.
// Used by the Settings UI to show a health status badge per provider.
providerRoutes.get('/health', (c) => {
  const env = getEnv()

  const configured: Record<string, boolean> = {
    anthropic: !!env.ANTHROPIC_API_KEY,
    openai: !!env.OPENAI_API_KEY,
    google: !!env.GOOGLE_API_KEY,
    groq: !!env.GROQ_API_KEY,
    mistral: !!env.MISTRAL_API_KEY,
    xai: !!env.XAI_API_KEY,
    cohere: !!env.COHERE_API_KEY,
    deepseek: !!env.DEEPSEEK_API_KEY,
    together: !!env.TOGETHER_API_KEY,
    openrouter: !!env.OPENROUTER_API_KEY,
    ollama: !!env.OLLAMA_BASE_URL,
  }

  return c.json({ configured })
})
