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
    if (!result.data.OPENAI_API_KEY && !result.data.ANTHROPIC_API_KEY) {
      console.error('At least one of OPENAI_API_KEY or ANTHROPIC_API_KEY is required')
      process.exit(1)
    }
    _env = result.data
  }
  return _env
}
