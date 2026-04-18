'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Send, Bot, User, Loader2, Wrench, Moon, Paperclip, FileText, X } from 'lucide-react'
import { api, type Message, type WorkspaceFile } from '@/lib/api'
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
  const [agentSlowWarning, setAgentSlowWarning] = useState(false)
  const [toolsInProgress, setToolsInProgress] = useState<string[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [templateType, setTemplateType] = useState<TemplateType>('general')
  const [attachedFiles, setAttachedFiles] = useState<WorkspaceFile[]>([])
  const [uploading, setUploading] = useState(false)
  const agentSlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WorkspaceSocket | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        setAgentSlowWarning(false)
        setToolsInProgress([])
        agentSlowTimerRef.current = setTimeout(() => setAgentSlowWarning(true), 20000)
      } else if (event.type === 'agent:tool_call') {
        setToolsInProgress(event.tools)
      } else if (event.type === 'agent:message') {
        if (event.message.threadId === threadId) {
          setMessages((prev) => {
            const without = prev.filter((m) => !m.id.startsWith('opt-'))
            return [...without, event.message]
          })
          setAgentThinking(false)
          setAgentSlowWarning(false)
          setToolsInProgress([])
          if (agentSlowTimerRef.current) clearTimeout(agentSlowTimerRef.current)
        }
      } else if (event.type === 'agent:complete') {
        setAgentThinking(false)
        setAgentSlowWarning(false)
        if (agentSlowTimerRef.current) clearTimeout(agentSlowTimerRef.current)
      } else if (event.type === 'agent:error') {
        setAgentThinking(false)
        setAgentSlowWarning(false)
        if (agentSlowTimerRef.current) clearTimeout(agentSlowTimerRef.current)
        setMessages((prev) => [
          ...prev.filter((m) => !m.id.startsWith('opt-')),
          {
            id: nanoid(),
            workspaceId: workspaceId ?? '',
            role: 'assistant' as const,
            content: 'I ran into a problem. Try again in a moment.',
            threadId,
            agentRunId: null,
            toolCalls: null,
            userId: null,
            externalMsgId: null,
            metadata: null,
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

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const uploaded = await api.integrations.uploadFile(slug, file)
      setAttachedFiles((prev) => [...prev, uploaded])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSend() {
    if (!input.trim() || sending) return
    const content = input.trim()
    const fileIds = attachedFiles.map((f) => f.id)
    setInput('')
    setAttachedFiles([])
    setSending(true)

    const optimisticId = `opt-${nanoid()}`
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        workspaceId: workspaceId ?? '',
        role: 'user' as const,
        content,
        threadId,
        agentRunId: null,
        toolCalls: null,
        userId: null,
        externalMsgId: null,
        metadata: null,
        channel: 'web',
        createdAt: new Date().toISOString(),
      },
    ])

    try {
      await api.chat.sendMessage(slug, threadId, content, fileIds.length > 0 ? fileIds : undefined)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setInput(content)
      setAttachedFiles(attachedFiles)
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
      {isAutopilotThread && (
        <div className="border-b border-border px-4 py-2.5 flex items-center gap-2 bg-primary/5">
          <Moon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Autopilot thread — managed by your coworker</span>
        </div>
      )}

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
                    onClick={async () => {
                      setInput(s)
                      setSending(true)
                      const optimisticId = `opt-${s}`
                      setMessages([{
                        id: optimisticId,
                        workspaceId: workspaceId ?? '',
                        role: 'user',
                        content: s,
                        threadId,
                        agentRunId: null,
                        toolCalls: null,
                        userId: null,
                        externalMsgId: null,
                        metadata: null,
                        channel: 'web',
                        createdAt: new Date().toISOString(),
                      }])
                      try {
                        await api.chat.sendMessage(slug, threadId, s)
                        setInput('')
                      } catch {
                        setMessages([])
                        setInput(s)
                      } finally {
                        setSending(false)
                      }
                    }}
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
            <div className="space-y-1.5">
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
              {agentSlowWarning && (
                <p className="text-xs text-muted-foreground px-1">
                  This is taking longer than usual…
                </p>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {!isAutopilotThread && (
        <div className="border-t border-border p-4">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Attached files preview */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1.5 rounded-lg bg-muted border border-border px-2.5 py-1.5 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button
                      onClick={() => setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* File attach button */}
              <label className={cn(
                'h-11 w-11 rounded-2xl border border-input flex items-center justify-center cursor-pointer hover:bg-accent transition-colors shrink-0',
                uploading && 'opacity-50 pointer-events-none'
              )}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={handleAttach}
                />
              </label>

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
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
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
