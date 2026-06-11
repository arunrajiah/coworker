'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Send, Bot, User, Loader2, Wrench, Moon, Paperclip, FileText, X, Copy, Check, ChevronDown, Cpu } from 'lucide-react'
import { api, type Message, type WorkspaceFile, type LLMProvider } from '@/lib/api'
import { WorkspaceSocket } from '@/lib/ws'
import { useAuthStore } from '@/store/auth'
import { cn, relativeTime } from '@/lib/utils'
import { nanoid } from 'nanoid'
import { MarkdownContent } from '@/components/MarkdownContent'
import { FOUNDER_TEMPLATES } from '@coworker/core'
import type { TemplateType } from '@coworker/core'

// Token cost per 1M tokens (output pricing — conservative estimate)
const COST_PER_1M: Partial<Record<string, number>> = {
  'claude-sonnet-4-5': 15,
  'claude-opus-4-5': 75,
  'claude-haiku-4-5': 1.25,
  'claude-3-5-sonnet-20241022': 15,
  'claude-3-5-haiku-20241022': 1.25,
  'gpt-4o': 15,
  'gpt-4o-mini': 0.6,
  'gpt-4-turbo': 30,
  'o1': 60,
  'o3-mini': 4.4,
  'gemini-2.0-flash': 0.7,
  'gemini-2.0-pro': 10,
  'gemini-1.5-pro': 10.5,
  'gemini-1.5-flash': 0.35,
  'llama-3.3-70b-versatile': 0.59,
  'llama-3.1-8b-instant': 0.05,
  'mistral-large-latest': 6,
  'mistral-small-latest': 0.6,
  'grok-3': 15,
  'grok-3-mini': 0.3,
  'command-r-plus': 2.5,
  'command-r': 0.075,
  'deepseek-chat': 1.1,
  'deepseek-reasoner': 2.19,
}

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  groq: 'Groq',
  mistral: 'Mistral',
  xai: 'xAI',
  cohere: 'Cohere',
  deepseek: 'DeepSeek',
  together: 'Together',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
}

const PROVIDER_MODELS: Record<LLMProvider, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'o1', label: 'o1' },
    { value: 'o3-mini', label: 'o3-mini' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ],
  mistral: [
    { value: 'mistral-large-latest', label: 'Mistral Large' },
    { value: 'mistral-small-latest', label: 'Mistral Small' },
    { value: 'codestral-latest', label: 'Codestral' },
    { value: 'open-mistral-nemo', label: 'Mistral Nemo' },
  ],
  xai: [
    { value: 'grok-3', label: 'Grok 3' },
    { value: 'grok-3-mini', label: 'Grok 3 Mini' },
    { value: 'grok-2-1212', label: 'Grok 2' },
  ],
  cohere: [
    { value: 'command-r-plus', label: 'Command R+' },
    { value: 'command-r', label: 'Command R' },
    { value: 'command-a-03-2025', label: 'Command A' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek V3' },
    { value: 'deepseek-reasoner', label: 'DeepSeek R1' },
  ],
  together: [
    { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B' },
    { value: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B' },
    { value: 'Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen 2.5 72B' },
  ],
  openrouter: [
    { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'openai/gpt-4o', label: 'GPT-4o' },
    { value: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  ],
  ollama: [
    { value: 'llama3.2', label: 'Llama 3.2' },
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'mistral', label: 'Mistral 7B' },
    { value: 'gemma2', label: 'Gemma 2' },
    { value: 'qwen2.5', label: 'Qwen 2.5' },
    { value: 'phi4', label: 'Phi-4' },
  ],
}

function estimateCost(tokens: number, model: string): string | null {
  const rate = COST_PER_1M[model]
  if (!rate) return null
  const cost = (tokens / 1_000_000) * rate
  if (cost < 0.001) return '<$0.001'
  return `$${cost.toFixed(4)}`
}

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

  // Model switcher state
  const [currentProvider, setCurrentProvider] = useState<LLMProvider | null>(null)
  const [currentModel, setCurrentModel] = useState<string | null>(null)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [switchingModel, setSwitchingModel] = useState(false)
  const modelPickerRef = useRef<HTMLDivElement>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WorkspaceSocket | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.workspaces.get(slug).then((ws) => {
      setWorkspaceId(ws.id)
      setTemplateType(ws.templateType as TemplateType)
      setCurrentProvider((ws.llmProvider as LLMProvider) ?? null)
      setCurrentModel(ws.llmModel ?? null)
    })
  }, [slug])

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

  async function handleModelSwitch(provider: LLMProvider, model: string) {
    setSwitchingModel(true)
    try {
      await api.workspaces.update(slug, { llmProvider: provider, llmModel: model })
      setCurrentProvider(provider)
      setCurrentModel(model)
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
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </button>

                {modelPickerOpen && (
                  <div className="absolute bottom-full mb-2 right-0 z-50 w-72 rounded-xl border border-border bg-background shadow-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs font-medium text-muted-foreground">Switch model</p>
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
                        onClick={async () => {
                          setSwitchingModel(true)
                          try {
                            await api.workspaces.update(slug, { llmProvider: null, llmModel: null })
                            setCurrentProvider(null)
                            setCurrentModel(null)
                            setModelPickerOpen(false)
                          } finally {
                            setSwitchingModel(false)
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Reset to server default
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

  const meta = message.metadata as { tokensUsed?: number; model?: string; provider?: string } | null
  const tokensUsed = meta?.tokensUsed ?? null
  const modelUsed = meta?.model ?? null
  const costStr = tokensUsed && modelUsed ? estimateCost(tokensUsed, modelUsed) : null

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
