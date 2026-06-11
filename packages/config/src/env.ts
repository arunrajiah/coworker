import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Auth
  AUTH_SECRET: z.string().min(32),

  // LLM — at least one required
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
  XAI_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),

  // Optional explicit override — supports "provider:model" syntax (e.g. "anthropic:claude-sonnet-4-5")
  LLM_PROVIDER: z.string().optional(),
  LLM_MODEL: z.string().optional(),

  // Google OAuth (optional — magic link works without it)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Email
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().email().default('coworker@localhost'),

  // File storage
  UPLOAD_DIR: z.string().default('./uploads'),

  // Telegram bot (optional — enables Telegram integration)
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // Local auth — skip email verification for self-hosted single-user deployments.
  // When true, entering any email on the login page signs you in immediately.
  LOCAL_AUTH: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),

  // App
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Ports
  API_PORT: z.coerce.number().default(3001),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | undefined

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env)
    if (!result.success) {
      console.error('Invalid environment variables:')
      console.error(result.error.flatten().fieldErrors)
      process.exit(1)
    }
    const d = result.data
    const hasKey = d.OPENAI_API_KEY || d.ANTHROPIC_API_KEY || d.GOOGLE_API_KEY || d.GROQ_API_KEY || d.MISTRAL_API_KEY || d.OLLAMA_BASE_URL || d.XAI_API_KEY || d.COHERE_API_KEY || d.DEEPSEEK_API_KEY || d.TOGETHER_API_KEY || d.OPENROUTER_API_KEY
    if (!hasKey) {
      console.error('At least one LLM provider key is required (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, or OLLAMA_BASE_URL)')
      process.exit(1)
    }
    _env = result.data
  }
  return _env
}
