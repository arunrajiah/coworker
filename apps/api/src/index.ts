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
app.route('/webhooks', webhookRoutes)

// Static file serving for uploads (local storage)
app.get('/uploads/*', async (c) => {
  const { storage } = await import('./container.js').then((m) => m.getContainer())
  const key = c.req.param('*')
  try {
    const buffer = await (storage as any).download(key)
    return new Response(buffer)
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

const server = createAdaptorServer({ fetch: app.fetch })

createWebSocketServer(server as unknown as import('node:http').Server)

server.listen(env.API_PORT, () => {
  console.log(`API running on http://localhost:${env.API_PORT}`)
})
