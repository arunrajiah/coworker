// Single source of truth for LLM providers, model catalogs, and pricing.
// Consumed by the web app (model pickers, cost display) and the worker (cost tracking).

export const LLM_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'groq',
  'mistral',
  'xai',
  'cohere',
  'deepseek',
  'together',
  'openrouter',
  'ollama',
] as const

export type LLMProviderId = (typeof LLM_PROVIDERS)[number]

export const PROVIDER_LABELS: Record<LLMProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  groq: 'Groq',
  mistral: 'Mistral',
  xai: 'xAI (Grok)',
  cohere: 'Cohere',
  deepseek: 'DeepSeek',
  together: 'Together AI',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (local)',
}

export interface CatalogModel {
  value: string
  label: string
}

export const PROVIDER_MODELS: Record<LLMProviderId, CatalogModel[]> = {
  anthropic: [
    { value: 'claude-opus-5', label: 'Claude Opus 5' },
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'o1', label: 'o1' },
    { value: 'o3-mini', label: 'o3-mini' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ],
  mistral: [
    { value: 'mistral-large-latest', label: 'Mistral Large' },
    { value: 'mistral-small-latest', label: 'Mistral Small' },
    { value: 'codestral-latest', label: 'Codestral' },
    { value: 'open-mistral-nemo', label: 'Mistral Nemo (open)' },
  ],
  xai: [
    { value: 'grok-3', label: 'Grok 3' },
    { value: 'grok-3-mini', label: 'Grok 3 Mini' },
    { value: 'grok-2-1212', label: 'Grok 2' },
  ],
  cohere: [
    { value: 'command-r-plus', label: 'Command R+' },
    { value: 'command-r', label: 'Command R' },
    { value: 'command-a-03-2025', label: 'Command A' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek V3' },
    { value: 'deepseek-reasoner', label: 'DeepSeek R1 (reasoner)' },
  ],
  together: [
    { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B Turbo' },
    { value: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B Turbo' },
    { value: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B' },
    { value: 'Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen 2.5 72B Turbo' },
  ],
  openrouter: [
    { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (via OpenRouter)' },
    { value: 'openai/gpt-4o', label: 'GPT-4o (via OpenRouter)' },
    { value: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash (via OpenRouter)' },
    { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (via OpenRouter)' },
  ],
  ollama: [
    { value: 'llama3.2', label: 'Llama 3.2' },
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'mistral', label: 'Mistral 7B' },
    { value: 'gemma2', label: 'Gemma 2' },
    { value: 'qwen2.5', label: 'Qwen 2.5' },
    { value: 'phi4', label: 'Phi-4' },
  ],
}

export interface TokenCost {
  input: number
  output: number
}

// USD per 1M tokens. Includes retired models so old messages still price correctly.
export const MODEL_COSTS: Record<string, TokenCost> = {
  // Anthropic (first-party API rates)
  'claude-opus-5': { input: 5.0, output: 25.0 },
  'claude-opus-4-8': { input: 5.0, output: 25.0 },
  'claude-opus-4-7': { input: 5.0, output: 25.0 },
  'claude-opus-4-6': { input: 5.0, output: 25.0 },
  'claude-opus-4-5': { input: 5.0, output: 25.0 },
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'o1': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 1.1, output: 4.4 },
  'o3-mini': { input: 1.1, output: 4.4 },
  // Google
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  // Groq
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'mixtral-8x7b-32768': { input: 0.27, output: 0.27 },
  'gemma2-9b-it': { input: 0.2, output: 0.2 },
  // Mistral
  'mistral-large-latest': { input: 2.0, output: 6.0 },
  'mistral-small-latest': { input: 0.2, output: 0.6 },
  'codestral-latest': { input: 0.3, output: 0.9 },
  'open-mistral-nemo': { input: 0.15, output: 0.15 },
  'open-mistral-7b': { input: 0.25, output: 0.25 },
  // xAI
  'grok-3': { input: 3.0, output: 15.0 },
  'grok-3-mini': { input: 0.3, output: 0.5 },
  'grok-2-1212': { input: 2.0, output: 10.0 },
  'grok-2': { input: 2.0, output: 10.0 },
  'grok-beta': { input: 5.0, output: 15.0 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  // Cohere
  'command-r-plus': { input: 2.5, output: 10.0 },
  'command-r': { input: 0.15, output: 0.6 },
  'command-a-03-2025': { input: 2.5, output: 10.0 },
  // Together
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': { input: 0.88, output: 0.88 },
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo': { input: 0.18, output: 0.18 },
  'mistralai/Mixtral-8x7B-Instruct-v0.1': { input: 0.6, output: 0.6 },
  'Qwen/Qwen2.5-72B-Instruct-Turbo': { input: 1.2, output: 1.2 },
}

// Provider-level fallback when the exact model is not in MODEL_COSTS.
export const PROVIDER_FALLBACK_COSTS: Record<string, TokenCost> = {
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
  ollama: { input: 0, output: 0 }, // self-hosted, no per-token cost
}

export function estimateCostUsd(
  model: string,
  provider: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rates = MODEL_COSTS[model] ?? PROVIDER_FALLBACK_COSTS[provider] ?? { input: 1.0, output: 3.0 }
  return (promptTokens * rates.input + completionTokens * rates.output) / 1_000_000
}

export function formatCostUsd(costUsd: number): string {
  if (costUsd <= 0) return 'free'
  if (costUsd < 0.001) return '<$0.001'
  return `$${costUsd.toFixed(4)}`
}
