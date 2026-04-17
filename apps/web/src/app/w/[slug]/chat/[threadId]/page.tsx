'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Send, Bot, User, Loader2, Wrench, Moon } from 'lucide-react'
import { api, type Message } from '@/lib/api'
import { WorkspaceSocket } from '@/lib/ws'
import { useAuthStore } from '@/store/auth'
import { cn, relativeTime } from '@/lib/utils'
import { nanoid } from 'nanoid'
import { FOUNDER_TEMPLATES } from '@coworker/core'
import type { TemplateType } from '@coworker/core'

export default function ThreadPage() {
  const params = useParams()
  const slug = params.slug as string
  const threadId = params.threadId as string

  const token = useAuthStore((s) => s.token)
  const isAutopilotThread = threadId.startsWith('autopilot:')

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [agentThinking, setAgentThinking] = useState(false)
  const [toolsInProgress, setToolsInProgress] = useState<string[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [templateType, setTemplateType] = useState<TemplateType>('general')

  const bottomRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WorkspaceSocket | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    api.workspaces.get(slug).then((ws) => {
      setWorkspaceId(ws.id)
      setTemplateType(ws.templateType as TemplateType)
    })
  }, [slug])

  useEffect(() => {
    api.chat.messages(slug, threadId).then(setMessages).catch(() => {})
  }, [slug, threadId])

  useEffect(() => {
    if (!workspaceId || !token) return
    const socket = new WorkspaceSocket(workspaceId, token)
    socketRef.current = socket
    socket.connect()

    const off = socket.on((event) => {
      if (event.type === 'agent:thinking') {
        setAgentThinking(true)
        setToolsInProgress([])
      } else if (event.type === 'agent:tool_call') {
        setToolsInProgress(event.tools)
      } else if (event.type === 'agent:message') {
        if (event.message.threadId === threadId) {
          setMessages((prev) => {
            const without = prev.filter((m) => !m.id.startsWith('opt-'))
            return [...without, event.message]
          })
          setAgentThinking(false)
          setToolsInProgress([])
        }
      } else if (event.type === 'agent:complete') {
        setAgentThinking(false)
      } else if (event.type === 'agent:error') {
        setAgentThinking(false)
        setMessages((prev) => [
          ...prev.filter((m) => !m.id.startsWith('opt-')),
          {
            id: nanoid(),
            workspaceId: workspaceId ?? '',
            role: 'assistant',
            content: "I ran into a problem. Try again in a moment.",
            threadId,
            agentRunId: null,
            channel: 'web',
            createdAt: new Date().toISOString(),
          },
        ])
      }
    })

    return () => {
      off()
      socket.disconnect()
    }
  }, [workspaceId, token, threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, agentThinking])

  async function handleSend() {
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)

    const optimisticId = `opt-${nanoid()}`
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        workspaceId: workspaceId ?? '',
        role: 'user',
        content,
        threadId,
        agentRunId: null,
        channel: 'web',
        createdAt: new Date().toISOString(),
      },
    ])

    try {
      await api.chat.sendMessage(slug, threadId, content)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const template = FOUNDER_TEMPLATES[templateType]
  const suggestions = template?.suggestedFirstActions ?? []
  const isEmpty = messages.length === 0 && !agentThinking

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      {isAutopilotThread && (
        <div className="border-b border-border px-4 py-2.5 flex items-center gap-2 bg-primary/5">
          <Moon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Autopilot thread — managed by your coworker</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-5">
            <div className="space-y-2">
              <Bot className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">What&apos;s on your mind?</p>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-col items-center gap-2 max-w-sm w-full">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="w-full text-left rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-accent hover:border-border/80 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {agentThinking && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-xs">
              {toolsInProgress.length > 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wrench className="h-3 w-3 animate-pulse" />
                  <span className="capitalize">{toolsInProgress[0].replace(/_/g, ' ')}…</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input — hidden for autopilot threads */}
      {!isAutopilotThread && (
        <div className="border-t border-border p-4">
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message your coworker…"
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-input bg-muted/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background min-h-[44px] max-h-[160px] transition-colors"
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border',
          isUser
            ? 'bg-primary border-primary text-primary-foreground'
            : 'bg-background border-border text-muted-foreground'
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={cn('space-y-1 max-w-[75ch]', isUser && 'items-end flex flex-col')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-xs text-muted-foreground px-1">{relativeTime(message.createdAt)}</p>
      </div>
    </div>
  )
}
