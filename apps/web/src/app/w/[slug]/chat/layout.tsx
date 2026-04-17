'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { Plus, MessageSquare, Moon, Bot } from 'lucide-react'
import { api, type Message } from '@/lib/api'
import { WorkspaceSocket } from '@/lib/ws'
import { useAuthStore } from '@/store/auth'
import { cn, relativeTime } from '@/lib/utils'
import { nanoid } from 'nanoid'

interface Thread {
  threadId: string
  lastMessage: Message
  hasAgentActivity: boolean
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const slug = params.slug as string
  const pathname = usePathname()
  const router = useRouter()
  const token = useAuthStore((s) => s.token)

  const [threads, setThreads] = useState<Thread[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  useEffect(() => {
    api.workspaces.get(slug).then((ws) => setWorkspaceId(ws.id))
  }, [slug])

  const loadThreads = useCallback(async () => {
    const msgs = await api.chat.threads(slug).catch(() => [] as Message[])
    const map = new Map<string, Thread>()
    for (const msg of msgs) {
      if (!map.has(msg.threadId)) {
        map.set(msg.threadId, {
          threadId: msg.threadId,
          lastMessage: msg,
          hasAgentActivity: msg.role === 'assistant',
        })
      }
    }
    setThreads(Array.from(map.values()))
  }, [slug])

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  // Listen for new messages via WebSocket to keep thread list live
  useEffect(() => {
    if (!workspaceId || !token) return
    const socket = new WorkspaceSocket(workspaceId, token)
    socket.connect()
    const off = socket.on((event) => {
      if (event.type === 'agent:message') loadThreads()
    })
    return () => {
      off()
      socket.disconnect()
    }
  }, [workspaceId, token, loadThreads])

  function startNewThread() {
    const id = nanoid()
    router.push(`/w/${slug}/chat/${id}`)
  }

  const activeThreadId = pathname.split('/').at(-1)
  const isBase = pathname === `/w/${slug}/chat`

  return (
    <div className="flex h-full">
      {/* Thread sidebar */}
      <aside className="w-60 shrink-0 border-r border-border flex flex-col bg-muted/30">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conversations</span>
          <button
            onClick={startNewThread}
            className="h-6 w-6 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="New conversation"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {threads.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8 px-3">
              Start a conversation — your coworker remembers everything.
            </p>
          )}
          {threads.map((thread) => {
            const isActive = activeThreadId === thread.threadId
            const isAutopilot = thread.threadId.startsWith('autopilot:')
            return (
              <button
                key={thread.threadId}
                onClick={() => router.push(`/w/${slug}/chat/${thread.threadId}`)}
                className={cn(
                  'w-full text-left rounded-lg px-3 py-2 transition-colors group',
                  isActive ? 'bg-background shadow-sm' : 'hover:bg-background/60'
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {isAutopilot ? (
                    <Moon className="h-3 w-3 text-primary shrink-0" />
                  ) : thread.hasAgentActivity ? (
                    <Bot className="h-3 w-3 text-muted-foreground shrink-0" />
                  ) : (
                    <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(thread.lastMessage.createdAt)}
                  </span>
                </div>
                <p className="text-xs leading-snug text-foreground line-clamp-2">
                  {thread.lastMessage.content}
                </p>
              </button>
            )
          })}
        </div>

        <div className="p-3 border-t border-border">
          <button
            onClick={startNewThread}
            className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-background/60 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3 w-3" />
            New conversation
          </button>
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        {isBase ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-muted-foreground">
            <Bot className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select a conversation or start a new one.</p>
            <button
              onClick={startNewThread}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New conversation
            </button>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
