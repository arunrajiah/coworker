const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/^http/, 'ws')

type WSEvent =
  | { type: 'connected'; workspaceId: string }
  | { type: 'agent:thinking'; agentRunId: string }
  | { type: 'agent:tool_call'; agentRunId: string; tools: string[] }
  | { type: 'agent:message'; agentRunId: string; message: import('./api').Message }
  | { type: 'agent:complete'; agentRunId: string }
  | { type: 'agent:error'; agentRunId: string; error: string }
  | { type: 'task:created'; task: import('./api').Task }
  | { type: 'task:updated'; task: import('./api').Task }

type EventHandler = (event: WSEvent) => void

export class WorkspaceSocket {
  private ws: WebSocket | null = null
  private handlers: Set<EventHandler> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false

  constructor(
    private workspaceId: string,
    private token: string
  ) {}

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    const url = `${API_URL}/ws?token=${this.token}&workspaceId=${this.workspaceId}`
    this.ws = new WebSocket(url)

    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as WSEvent
        this.handlers.forEach((h) => h(event))
      } catch {}
    }

    this.ws.onclose = () => {
      if (!this.closed) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000)
      }
    }

    this.ws.onerror = () => this.ws?.close()
  }

  on(handler: EventHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  disconnect() {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }
}
