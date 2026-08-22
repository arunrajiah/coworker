import type { Context, Next } from 'hono'

interface Bucket {
  count: number
  resetAt: number
}

// Fixed-window in-memory rate limiter. Good enough for a single API instance;
// swap the store for Redis if the API is ever scaled horizontally.
export function rateLimit(opts: { windowMs: number; max: number; keyPrefix: string }) {
  const buckets = new Map<string, Bucket>()

  // Drop expired buckets so long-running processes don't accumulate stale keys
  setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }, opts.windowMs).unref()

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown'
    const key = `${opts.keyPrefix}:${ip}`
    const now = Date.now()

    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs }
      buckets.set(key, bucket)
    }

    bucket.count += 1
    if (bucket.count > opts.max) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
      return c.json({ error: 'Too many requests, try again later' }, 429)
    }

    await next()
  }
}
