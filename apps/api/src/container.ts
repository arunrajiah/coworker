import { createClient } from '@coworker/db'
import { getEnv } from '@coworker/config'
import { LocalFileStorage } from '@coworker/adapter-storage-local'
import { ConsoleEmailProvider, NodemailerEmailProvider } from '@coworker/adapter-email-nodemailer'
import { NoopBillingProvider } from '@coworker/adapter-billing-noop'
import type { IFileStorage, IEmailProvider, IBillingProvider } from '@coworker/core'
import { Redis } from 'ioredis'

export interface Container {
  db: ReturnType<typeof createClient>
  redis: Redis
  storage: IFileStorage
  email: IEmailProvider
  billing: IBillingProvider
}

let _container: Container | undefined

export function getContainer(): Container {
  if (!_container) {
    const env = getEnv()

    const db = createClient(env.DATABASE_URL)
    const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

    const storage = new LocalFileStorage(env.UPLOAD_DIR, env.API_URL)

    const email: IEmailProvider =
      env.SMTP_URL
        ? new NodemailerEmailProvider(env.SMTP_URL, env.EMAIL_FROM)
        : new ConsoleEmailProvider()

    const billing: IBillingProvider = new NoopBillingProvider()

    _container = { db, redis, storage, email, billing }
  }
  return _container
}
