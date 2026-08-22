import { createAdaptorServer } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { getEnv } from '@coworker/config'
import { authRoutes } from './routes/auth.js'
import { workspaceRoutes } from './routes/workspaces.js'
import { taskRoutes } from './routes/tasks.js'
import { chatRoutes } from './routes/chat.js'
import { skillRoutes } from './routes/skills.js'
import { autopilotRoutes } from './routes/autopilot.js'
import { activityRoutes } from './routes/activity.js'
import { integrationRoutes } from './routes/integrations.js'
import { gitRoutes } from './routes/git.js'
import { webhookRoutes } from './routes/webhook.js'
import { vercelRoutes } from './routes/vercel.js'
import { providerRoutes } from './routes/providers.js'
import { memoryRoutes } from './routes/memories.js'
import { linearRoutes } from './routes/linear.js'
import { notionRoutes } from './routes/notion.js'
import { gcalRoutes } from './routes/gcal.js'
import { usageRoutes } from './routes/usage.js'
import { specRoutes } from './routes/specs.js'
import { createWebSocketServer } from './ws/gateway.js'

const env = getEnv()

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: env.APP_URL,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Slug'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
)

app.get('/health', (c) => c.json({ ok: true, version: '0.1.0' }))

app.route('/api/auth', authRoutes)
app.route('/api/workspaces', workspaceRoutes)
app.route('/api/workspaces/:workspaceSlug/tasks', taskRoutes)
app.route('/api/workspaces/:workspaceSlug/chat', chatRoutes)
app.route('/api/workspaces/:workspaceSlug/skills', skillRoutes)
app.route('/api/workspaces/:workspaceSlug/autopilot', autopilotRoutes)
app.route('/api/workspaces/:workspaceSlug/activity', activityRoutes)
app.route('/api/workspaces/:workspaceSlug/integrations', integrationRoutes)
app.route('/api/workspaces/:workspaceSlug/git', gitRoutes)
app.route('/api/workspaces/:workspaceSlug/vercel', vercelRoutes)
app.route('/api/providers', providerRoutes)
app.route('/api/workspaces/:workspaceSlug/memories', memoryRoutes)
app.route('/api/workspaces/:workspaceSlug/linear', linearRoutes)
app.route('/api/workspaces/:workspaceSlug/notion', notionRoutes)
app.route('/api/workspaces/:workspaceSlug/gcal', gcalRoutes)
app.route('/api/workspaces/:workspaceSlug/usage', usageRoutes)
app.route('/api/workspaces/:workspaceSlug/specs', specRoutes)
app.route('/webhooks', webhookRoutes)

// Static file serving for uploads (local storage).
// URLs are signed (HMAC over key + expiry with AUTH_SECRET); unsigned or expired
// links are rejected, so knowing a storage key alone is not enough to fetch a file.
app.get('/uploads/*', async (c) => {
  const { storage } = await import('./container.js').then((m) => m.getContainer())
  const { verifyUploadSignature } = await import('@coworker/adapter-storage-local')
  // Hono does not expose '*' as a named param; take the key from the path.
  const key = decodeURIComponent(c.req.path.replace(/^\/uploads\//, ''))
  if (!key) return c.json({ error: 'Not found' }, 404)

  if (!verifyUploadSignature(key, c.req.query('exp'), c.req.query('sig'), env.AUTH_SECRET)) {
    return c.json({ error: 'Invalid or expired link' }, 403)
  }

  try {
    const buffer = await (storage as any).download(key)
    return new Response(buffer, {
      headers: {
        'Content-Type': MIME_BY_EXT[key.slice(key.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json',
}

const server = createAdaptorServer({ fetch: app.fetch })

createWebSocketServer(server as unknown as import('node:http').Server)

server.listen(env.API_PORT, () => {
  console.log(`API running on http://localhost:${env.API_PORT}`)
})
