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

// Live probe: calls each configured provider's cheapest authenticated endpoint
// (usually the models list) to prove the key actually works, not just that it is set.
interface ProbeResult {
  configured: boolean
  ok: boolean
  latencyMs?: number
  error?: string
}

const PROBE_TIMEOUT_MS = 6000

async function probeHttp(url: string, headers: Record<string, string> = {}): Promise<ProbeResult> {
  const started = Date.now()
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    const latencyMs = Date.now() - started
    if (res.ok) return { configured: true, ok: true, latencyMs }
    const reason =
      res.status === 401 || res.status === 403
        ? 'Invalid API key'
        : res.status === 429
          ? 'Rate limited'
          : `HTTP ${res.status}`
    return { configured: true, ok: false, latencyMs, error: reason }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - started,
      error: timedOut ? 'Timed out' : 'Unreachable',
    }
  }
}

providerRoutes.post('/probe', async (c) => {
  const env = getEnv()
  const bearer = (key: string) => ({ Authorization: `Bearer ${key}` })

  const probes: Record<string, (() => Promise<ProbeResult>) | null> = {
    anthropic: env.ANTHROPIC_API_KEY
      ? () =>
          probeHttp('https://api.anthropic.com/v1/models', {
            'x-api-key': env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          })
      : null,
    openai: env.OPENAI_API_KEY
      ? () => probeHttp('https://api.openai.com/v1/models', bearer(env.OPENAI_API_KEY!))
      : null,
    google: env.GOOGLE_API_KEY
      ? () =>
          probeHttp(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(env.GOOGLE_API_KEY!)}`
          )
      : null,
    groq: env.GROQ_API_KEY
      ? () => probeHttp('https://api.groq.com/openai/v1/models', bearer(env.GROQ_API_KEY!))
      : null,
    mistral: env.MISTRAL_API_KEY
      ? () => probeHttp('https://api.mistral.ai/v1/models', bearer(env.MISTRAL_API_KEY!))
      : null,
    xai: env.XAI_API_KEY
      ? () => probeHttp('https://api.x.ai/v1/models', bearer(env.XAI_API_KEY!))
      : null,
    cohere: env.COHERE_API_KEY
      ? () => probeHttp('https://api.cohere.com/v1/models', bearer(env.COHERE_API_KEY!))
      : null,
    deepseek: env.DEEPSEEK_API_KEY
      ? () => probeHttp('https://api.deepseek.com/models', bearer(env.DEEPSEEK_API_KEY!))
      : null,
    together: env.TOGETHER_API_KEY
      ? () => probeHttp('https://api.together.xyz/v1/models', bearer(env.TOGETHER_API_KEY!))
      : null,
    // The models list is public on OpenRouter; /key validates the actual key.
    openrouter: env.OPENROUTER_API_KEY
      ? () => probeHttp('https://openrouter.ai/api/v1/key', bearer(env.OPENROUTER_API_KEY!))
      : null,
    ollama: env.OLLAMA_BASE_URL
      ? () => probeHttp(`${env.OLLAMA_BASE_URL!.replace(/\/$/, '')}/api/tags`)
      : null,
  }

  const entries = await Promise.all(
    Object.entries(probes).map(async ([provider, probe]): Promise<[string, ProbeResult]> => [
      provider,
      probe ? await probe() : { configured: false, ok: false },
    ])
  )

  return c.json({ results: Object.fromEntries(entries) })
})
