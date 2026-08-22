'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Send, Bot, User, Loader2, Wrench, Moon, Paperclip, FileText, X, Copy, Check, ChevronDown, Cpu, FolderOpen } from 'lucide-react'
import { api, type Message, type WorkspaceFile, type LLMProvider } from '@/lib/api'
import { toast } from 'sonner'
import { WorkspaceSocket } from '@/lib/ws'
import { useAuthStore } from '@/store/auth'
import { cn, relativeTime } from '@/lib/utils'
import { nanoid } from 'nanoid'
import { MarkdownContent } from '@/components/MarkdownContent'
import {
  FOUNDER_TEMPLATES,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  estimateCostUsd,
  formatCostUsd,
} from '@coworker/core'
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
  const [isDragging, setIsDragging] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([])
  const [loadingWorkspaceFiles, setLoadingWorkspaceFiles] = useState(false)
  const agentSlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Model switcher state. The workspace default and the per-thread override are
  // tracked separately; the thread override wins when set.
  const [wsProvider, setWsProvider] = useState<LLMProvider | null>(null)
  const [wsModel, setWsModel] = useState<string | null>(null)
  const [threadProvider, setThreadProvider] = useState<LLMProvider | null>(null)
  const [threadModel, setThreadModel] = useState<string | null>(null)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [switchingModel, setSwitchingModel] = useState(false)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  // Override picked on a brand-new thread before its id exists server-side
  const pendingOverrideRef = useRef<{ provider: LLMProvider; model: string } | null>(null)

  const currentProvider = threadProvider ?? wsProvider
  const currentModel = threadProvider ? threadModel : wsModel

  const bottomRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WorkspaceSocket | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.workspaces.get(slug).then((ws) => {
      setWorkspaceId(ws.id)
      setTemplateType(ws.templateType as TemplateType)
      setWsProvider((ws.llmProvider as LLMProvider) ?? null)
      setWsModel(ws.llmModel ?? null)
    })
  }, [slug])

  // Load this thread's model override (none for brand-new threads)
  useEffect(() => {
    setThreadProvider(null)
    setThreadModel(null)
    pendingOverrideRef.current = null
    if (threadId === 'new' || isAutopilotThread) return
    api.chat
      .getThreadSettings(slug, threadId)
      .then((s) => {
        setThreadProvider(s.llmProvider)
        setThreadModel(s.llmModel)
      })
      .catch(() => {})
  }, [slug, threadId, isAutopilotThread])

  // Close model picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
      } else if (event.type === 'budget:alert') {
        const pct = event.thresholdPct as number
        const spend = (event.spendUsd as number).toFixed(4)
        const budget = (event.budgetUsd as number).toFixed(2)
        if (pct >= 100) {
          toast.error(`Budget exceeded: $${spend} spent of $${budget} monthly limit`, { duration: 8000 })
        } else {
          toast.warning(`Budget alert: ${pct}% of $${budget} monthly limit used ($${spend})`, { duration: 6000 })
        }
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

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(files.map((f) => api.integrations.uploadFile(slug, f)))
      setAttachedFiles((prev) => {
        const existingIds = new Set(prev.map((f) => f.id))
        return [...prev, ...uploaded.filter((f) => !existingIds.has(f.id))]
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [slug])

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) await uploadFiles(e.target.files)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) await uploadFiles(e.dataTransfer.files)
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files)
    if (files.length > 0) {
      e.preventDefault()
      await uploadFiles(files)
    }
  }

  async function handleOpenBrowse() {
    setBrowseOpen(true)
    if (workspaceFiles.length === 0) {
      setLoadingWorkspaceFiles(true)
      try {
        const files = await api.integrations.listFiles(slug)
        setWorkspaceFiles(files)
      } finally {
        setLoadingWorkspaceFiles(false)
      }
    }
  }

  function handleAttachExisting(file: WorkspaceFile) {
    setAttachedFiles((prev) => prev.find((f) => f.id === file.id) ? prev : [...prev, file])
    setBrowseOpen(false)
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
      // A model picked before the thread exists needs the thread id up front,
      // so mint it client-side and save the override before the first message.
      let sendThreadId = threadId
      if (threadId === 'new' && pendingOverrideRef.current) {
        sendThreadId = nanoid()
        const { provider, model } = pendingOverrideRef.current
        await api.chat.setThreadSettings(slug, sendThreadId, provider, model)
        pendingOverrideRef.current = null
      }
      await api.chat.sendMessage(slug, sendThreadId, content, fileIds.length > 0 ? fileIds : undefined)
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

  async function handleModelSwitch(provider: LLMProvider, model: string) {
    // Applies to this thread only; the workspace default is unchanged.
    if (threadId === 'new') {
      pendingOverrideRef.current = { provider, model }
      setThreadProvider(provider)
      setThreadModel(model)
      setModelPickerOpen(false)
      return
    }
    setSwitchingModel(true)
    try {
      await api.chat.setThreadSettings(slug, threadId, provider, model)
      setThreadProvider(provider)
      setThreadModel(model)
      setModelPickerOpen(false)
    } finally {
      setSwitchingModel(false)
    }
  }

  async function handleModelReset() {
    if (threadId === 'new') {
      pendingOverrideRef.current = null
      setThreadProvider(null)
      setThreadModel(null)
      setModelPickerOpen(false)
      return
    }
    setSwitchingModel(true)
    try {
      await api.chat.setThreadSettings(slug, threadId, null, null)
      setThreadProvider(null)
      setThreadModel(null)
      setModelPickerOpen(false)
    } finally {
      setSwitchingModel(false)
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
          <span className="text-xs font-medium text-primary">Autopilot thread: managed by your coworker</span>
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

        {messages.map((msg, i) => {
          const prevMsg = messages[i - 1]
          const msgDate = new Date(msg.createdAt)
          const prevDate = prevMsg ? new Date(prevMsg.createdAt) : null
          const showDateSep =
            !prevDate ||
            msgDate.getFullYear() !== prevDate.getFullYear() ||
            msgDate.getMonth() !== prevDate.getMonth() ||
            msgDate.getDate() !== prevDate.getDate()

          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          msgDate.setHours(0, 0, 0, 0)

          let dateLabel: string
          if (msgDate.getTime() === today.getTime()) dateLabel = 'Today'
          else if (msgDate.getTime() === yesterday.getTime()) dateLabel = 'Yesterday'
          else dateLabel = new Date(msg.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{dateLabel}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <MessageBubble message={msg} />
            </div>
          )
        })}

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

            {/* Browse existing files panel */}
            {browseOpen && (
              <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-medium">Attach from workspace files</span>
                  <button onClick={() => setBrowseOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {loadingWorkspaceFiles ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : workspaceFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No files uploaded yet</p>
                  ) : (
                    workspaceFiles.map((f) => {
                      const alreadyAttached = attachedFiles.some((a) => a.id === f.id)
                      return (
                        <button
                          key={f.id}
                          onClick={() => handleAttachExisting(f)}
                          disabled={alreadyAttached}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent disabled:opacity-40 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs flex-1 truncate">{f.name}</span>
                          {alreadyAttached && <span className="text-xs text-muted-foreground">attached</span>}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            <div
              className={cn(
                'flex items-end gap-2 rounded-2xl transition-colors',
                isDragging && 'outline outline-2 outline-primary outline-offset-2 bg-primary/5'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
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
                  multiple
                  className="hidden"
                  accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={handleAttach}
                />
              </label>

              {/* Browse existing files button */}
              <button
                type="button"
                onClick={handleOpenBrowse}
                className="h-11 w-11 rounded-2xl border border-input flex items-center justify-center hover:bg-accent transition-colors shrink-0"
                title="Attach from workspace files"
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={isDragging ? 'Drop files to attach…' : 'Message your coworker…'}
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

            {/* Model switcher pill */}
            <div className="flex items-center justify-end" ref={modelPickerRef}>
              <div className="relative">
                <button
                  onClick={() => setModelPickerOpen((o) => !o)}
                  disabled={switchingModel}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-muted/60 hover:bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {switchingModel ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Cpu className="h-3 w-3" />
                  )}
                  <span>
                    {currentProvider
                      ? `${PROVIDER_LABELS[currentProvider]} · ${currentModel ?? 'default'}`
                      : 'Server default'}
                    {threadProvider && <span className="text-primary"> · this thread</span>}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </button>

                {modelPickerOpen && (
                  <div className="absolute bottom-full mb-2 right-0 z-50 w-72 rounded-xl border border-border bg-background shadow-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs font-medium text-muted-foreground">Switch model for this thread</p>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {(Object.keys(PROVIDER_LABELS) as LLMProvider[]).map((p) => (
                        <div key={p}>
                          <div className="px-3 py-1.5 bg-muted/40 border-b border-border">
                            <span className="text-xs font-medium text-muted-foreground">{PROVIDER_LABELS[p]}</span>
                          </div>
                          {PROVIDER_MODELS[p].map((m) => (
                            <button
                              key={m.value}
                              onClick={() => handleModelSwitch(p, m.value)}
                              className={cn(
                                'w-full text-left px-4 py-2 text-xs hover:bg-accent transition-colors flex items-center justify-between gap-2',
                                currentProvider === p && currentModel === m.value && 'text-primary font-medium'
                              )}
                            >
                              <span>{m.label}</span>
                              {currentProvider === p && currentModel === m.value && (
                                <Check className="h-3 w-3 text-primary shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 border-t border-border">
                      <button
                        onClick={handleModelReset}
                        disabled={!threadProvider}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Use workspace default
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const meta = message.metadata as {
    tokensUsed?: number
    promptTokens?: number
    completionTokens?: number
    costUsd?: number
    model?: string
    provider?: string
  } | null
  const tokensUsed = meta?.tokensUsed ?? null
  const modelUsed = meta?.model ?? null
  // Prefer the exact cost the worker computed; estimate only for old messages that predate costUsd.
  const costUsd =
    meta?.costUsd ??
    (meta?.model && meta.promptTokens != null && meta.completionTokens != null
      ? estimateCostUsd(meta.model, meta.provider ?? '', meta.promptTokens, meta.completionTokens)
      : null)
  const costStr = costUsd != null ? formatCostUsd(costUsd) : null

  async function handleCopy() {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('flex gap-3 group/msg', isUser && 'flex-row-reverse')}>
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
      <div className={cn('space-y-1 max-w-[75ch] min-w-0', isUser && 'items-end flex flex-col')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>
        <div className={cn('flex items-center gap-1.5 px-1 flex-wrap', isUser && 'flex-row-reverse')}>
          <p className="text-xs text-muted-foreground">{relativeTime(message.createdAt)}</p>
          {!isUser && tokensUsed && (
            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
              <span>{tokensUsed.toLocaleString()} tokens</span>
              {costStr && <span>· {costStr}</span>}
            </span>
          )}
          {!isUser && modelUsed && (
            <span className="text-xs text-muted-foreground/50">{modelUsed}</span>
          )}
          <button
            onClick={handleCopy}
            title="Copy message"
            className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-foreground"
          >
            {copied
              ? <Check className="h-3 w-3 text-green-500" />
              : <Copy className="h-3 w-3" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
