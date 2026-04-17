import { WebSocketServer, type WebSocket } from 'ws'
import type { IncomingMessage } from 'node:http'
import { verifyToken } from '../lib/auth.js'
import { getContainer } from '../container.js'

type Room = Set<WebSocket>

const rooms = new Map<string, Room>()

export function getRoom(workspaceId: string): Room {
  let room = rooms.get(workspaceId)
  if (!room) {
    room = new Set()
    rooms.set(workspaceId, room)
  }
  return room
}

export function broadcast(workspaceId: string, event: unknown) {
  const room = rooms.get(workspaceId)
  if (!room) return
  const payload = JSON.stringify(event)
  for (const ws of room) {
    if (ws.readyState === ws.OPEN) ws.send(payload)
  }
}

export function createWebSocketServer(server: import('node:http').Server) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  // Subscribe to Redis pub/sub for cross-process events
  const { redis } = getContainer()
  const subscriber = redis.duplicate()
  subscriber.psubscribe('ws:*')
  subscriber.on('pmessage', (_pattern, channel, message) => {
    const workspaceId = channel.replace('ws:', '')
    const room = rooms.get(workspaceId)
    if (!room) return
    for (const ws of room) {
      if (ws.readyState === ws.OPEN) ws.send(message)
    }
  })

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const token = url.searchParams.get('token')
    const workspaceId = url.searchParams.get('workspaceId')

    if (!token || !workspaceId) {
      ws.close(4001, 'Missing token or workspaceId')
      return
    }

    try {
      await verifyToken(token)
    } catch {
      ws.close(4001, 'Invalid token')
      return
    }

    const room = getRoom(workspaceId)
    room.add(ws)

    ws.on('close', () => room.delete(ws))
    ws.send(JSON.stringify({ type: 'connected', workspaceId }))
  })

  return wss
}
