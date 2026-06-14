// Cost per 1M tokens in USD (input / output)
// Prices as of mid-2025 — update as providers change pricing
const COST_TABLE: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4-8': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'o1': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 1.1, output: 4.4 },
  // Google
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  // Groq (inference cost)
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'mixtral-8x7b-32768': { input: 0.27, output: 0.27 },
  // Mistral
  'mistral-large-latest': { input: 2.0, output: 6.0 },
  'mistral-small-latest': { input: 0.2, output: 0.6 },
  'open-mistral-7b': { input: 0.25, output: 0.25 },
  // xAI
  'grok-2': { input: 2.0, output: 10.0 },
  'grok-beta': { input: 5.0, output: 15.0 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  // Cohere
  'command-r-plus': { input: 2.5, output: 10.0 },
  'command-r': { input: 0.15, output: 0.6 },
}

// Provider-level fallback when exact model not found
const PROVIDER_FALLBACK: Record<string, { input: number; output: number }> = {
  anthropic: { input: 3.0, output: 15.0 },
  openai: { input: 2.5, output: 10.0 },
  google: { input: 1.25, output: 5.0 },
  groq: { input: 0.27, output: 0.27 },
  mistral: { input: 2.0, output: 6.0 },
  xai: { input: 2.0, output: 10.0 },
  cohere: { input: 0.15, output: 0.6 },
  deepseek: { input: 0.14, output: 0.28 },
  together: { input: 0.2, output: 0.2 },
  openrouter: { input: 1.0, output: 3.0 },
  ollama: { input: 0, output: 0 }, // self-hosted, no cost
}

export function estimateCostUsd(
  model: string,
  provider: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rates = COST_TABLE[model] ?? PROVIDER_FALLBACK[provider] ?? { input: 1.0, output: 3.0 }
  return (promptTokens * rates.input + completionTokens * rates.output) / 1_000_000
}
