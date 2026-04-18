'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Trash2, ToggleLeft, ToggleRight, Send, CheckCircle2, Loader2, Paperclip, FileText, X, Eye, AlertCircle, Clock, Cpu, GitBranch, Copy, RefreshCw, Unplug, RotateCcw, Triangle, ExternalLink } from 'lucide-react'
import { api, type Skill, type TelegramConnection, type WorkspaceFile, type ExtractedFileContent, type LLMProvider, type Workspace, type GitConnection, type GitProvider, type VercelConnection, type VercelDeployment } from '@/lib/api'
import { WorkspaceSocket } from '@/lib/ws'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

const SETTINGS_TABS = [
  { id: 'general', label: 'General' },
  { id: 'ai', label: 'AI Model' },
  { id: 'git', label: 'Git' },
  { id: 'vercel', label: 'Vercel' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'files', label: 'Files' },
] as const

type SettingsTab = (typeof SETTINGS_TABS)[number]['id']

export default function SettingsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 shrink-0">
        <h1 className="text-base font-semibold">Settings</h1>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border px-6 flex gap-0.5 shrink-0">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-foreground text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {activeTab === 'general' && <GeneralSection slug={slug} />}
          {activeTab === 'ai' && <ModelSection slug={slug} />}
          {activeTab === 'git' && <GitSection slug={slug} />}
          {activeTab === 'vercel' && <VercelSection slug={slug} />}
          {activeTab === 'telegram' && <TelegramSection slug={slug} />}
          {activeTab === 'files' && <FilesSection slug={slug} />}
        </div>
      </div>
    </div>
  )
}

// ── General Section ───────────────────────────────────────────────────────────

function GeneralSection({ slug }: { slug: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.workspaces.get(slug).then((ws) => {
      setWorkspace(ws)
      setName(ws.name)
    })
  }, [slug])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || name === workspace?.name) return
    setSaving(true)
    try {
      const updated = await api.workspaces.update(slug, { name: name.trim() })
      setWorkspace(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-medium">Workspace</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Basic workspace settings</p>
      </div>

      <form onSubmit={handleSave} className="space-y-3 max-w-sm">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Workspace name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My workspace"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !name.trim() || name === workspace?.name}
            className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </div>
      </form>

      <div className="border-t border-border pt-6 space-y-3">
        <div>
          <h3 className="text-sm font-medium text-destructive">Danger zone</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Workspace ID: <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">{workspace?.id ?? '…'}</code>
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Model Section ─────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  groq: 'Groq',
  mistral: 'Mistral',
  ollama: 'Ollama (local)',
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
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ],
  mistral: [
    { value: 'mistral-large-latest', label: 'Mistral Large' },
    { value: 'mistral-small-latest', label: 'Mistral Small' },
    { value: 'codestral-latest', label: 'Codestral' },
    { value: 'open-mistral-nemo', label: 'Mistral Nemo (open)' },
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

function ModelSection({ slug }: { slug: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [provider, setProvider] = useState<LLMProvider | ''>('')
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.workspaces.get(slug).then((ws) => {
      setWorkspace(ws)
      setProvider(ws.llmProvider ?? '')
      setModel(ws.llmModel ?? '')
    })
  }, [slug])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await api.workspaces.update(slug, {
        llmProvider: provider || null,
        llmModel: model || null,
      })
      setWorkspace(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const models = provider ? PROVIDER_MODELS[provider as LLMProvider] : []

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          AI Model
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Override the server default with a specific provider and model for this workspace
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <select
              value={provider}
              onChange={(e) => {
                const p = e.target.value as LLMProvider | ''
                setProvider(p)
                setModel(p ? PROVIDER_MODELS[p][0]?.value ?? '' : '')
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Server default</option>
              {(Object.keys(PROVIDER_LABELS) as LLMProvider[]).map((p) => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Model</label>
            {provider ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {models.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
                <option value="">Custom…</option>
              </select>
            ) : (
              <div className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Using server default
              </div>
            )}
          </div>
        </div>

        {provider && model === '' && (
          <input
            placeholder="Custom model name (e.g. my-finetuned-model)"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          {workspace?.llmProvider && (
            <span className="text-xs text-muted-foreground">
              Currently: {PROVIDER_LABELS[workspace.llmProvider]}{workspace.llmModel ? ` · ${workspace.llmModel}` : ''}
            </span>
          )}
        </div>
      </form>
    </section>
  )
}

// ── Git Section ───────────────────────────────────────────────────────────────

const GIT_PROVIDER_LABELS: Record<GitProvider, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
}

const WEBHOOK_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function GitSection({ slug }: { slug: string }) {
  const [connections, setConnections] = useState<GitConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [form, setForm] = useState({ provider: 'github' as GitProvider, repoOwner: '', repoName: '', accessToken: '' })
  const [newConn, setNewConn] = useState<(GitConnection & { webhookSecret: string }) | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncResults, setSyncResults] = useState<Record<string, string>>({})
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; label: string }>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    api.git.list(slug).then((c) => { setConnections(c); setLoading(false) }).catch(() => setLoading(false))
  }, [slug])

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setConnecting(true)
    try {
      const conn = await api.git.connect(slug, form)
      setConnections((prev) => [conn, ...prev])
      setNewConn(conn)
      setForm({ provider: 'github', repoOwner: '', repoName: '', accessToken: '' })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect(id: string) {
    await api.git.disconnect(slug, id)
    setConnections((prev) => prev.filter((c) => c.id !== id))
    if (newConn?.id === id) setNewConn(null)
  }

  async function handleTest(id: string) {
    setTestingId(id)
    try {
      const result = await api.git.test(slug, id)
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: result.ok, label: result.ok ? `OK · ${result.repo?.fullName ?? ''}` : result.error ?? 'Failed' },
      }))
    } finally {
      setTestingId(null)
    }
  }

  async function handleSync(id: string) {
    setSyncingId(id)
    try {
      const result = await api.git.sync(slug, id)
      setSyncResults((prev) => ({ ...prev, [id]: `Synced: ${result.created} new, ${result.updated} updated (${result.total} total issues)` }))
    } catch (err) {
      setSyncResults((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Sync failed' }))
    } finally {
      setSyncingId(null)
    }
  }

  async function copyWebhookUrl(conn: GitConnection) {
    const url = `${WEBHOOK_BASE}/webhooks/git/${conn.id}`
    await navigator.clipboard.writeText(url)
    setCopiedId(conn.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          Git Repositories
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect GitHub, GitLab, or Bitbucket repos. The agent can read issues, create tasks, and receive webhook events.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : (
        <>
          {connections.length > 0 && (
            <div className="space-y-2">
              {connections.map((conn) => (
                <div key={conn.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        {GIT_PROVIDER_LABELS[conn.provider]}
                      </span>
                      <span className="text-sm font-medium">{conn.repoOwner}/{conn.repoName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSync(conn.id)}
                        disabled={syncingId === conn.id}
                        title="Sync issues to board"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {syncingId === conn.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RotateCcw className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleTest(conn.id)}
                        disabled={testingId === conn.id}
                        title="Test connection"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {testingId === conn.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RefreshCw className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleDisconnect(conn.id)}
                        title="Disconnect"
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Unplug className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {testResults[conn.id] && (
                    <p className={`text-xs ${testResults[conn.id].ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {testResults[conn.id].ok ? '✓' : '✗'} {testResults[conn.id].label}
                    </p>
                  )}
                  {syncResults[conn.id] && (
                    <p className="text-xs text-muted-foreground">{syncResults[conn.id]}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Webhook URL:</p>
                    <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
                      {WEBHOOK_BASE}/webhooks/git/{conn.id}
                    </code>
                    <button
                      onClick={() => copyWebhookUrl(conn)}
                      title="Copy webhook URL"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      {copiedId === conn.id
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {newConn && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Save your webhook secret</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This will only be shown once. Add this as the webhook secret when registering the webhook in your git provider.
              </p>
              <code className="block text-xs font-mono bg-background border border-border rounded px-3 py-2 break-all">
                {newConn.webhookSecret}
              </code>
              <button onClick={() => setNewConn(null)} className="text-xs text-amber-700 dark:text-amber-400 underline">
                I&apos;ve saved it
              </button>
            </div>
          )}

          <form onSubmit={handleConnect} className="rounded-lg border border-dashed border-border p-4 space-y-3">
            <p className="text-sm font-medium">Connect a repository</p>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as GitProvider }))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="bitbucket">Bitbucket</option>
              </select>
              <input
                required
                placeholder="owner / org"
                value={form.repoOwner}
                onChange={(e) => setForm((f) => ({ ...f, repoOwner: e.target.value }))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                required
                placeholder="repo name"
                value={form.repoName}
                onChange={(e) => setForm((f) => ({ ...f, repoName: e.target.value }))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <input
              required
              type="password"
              placeholder="Personal access token (PAT)"
              value={form.accessToken}
              onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
            >
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Connect
            </button>
          </form>
        </>
      )}
    </section>
  )
}

// ── Vercel Section ────────────────────────────────────────────────────────────

const DEPLOYMENT_STATE_COLOR: Record<string, string> = {
  READY: 'text-green-600 dark:text-green-400',
  BUILDING: 'text-blue-500 animate-pulse',
  INITIALIZING: 'text-blue-400 animate-pulse',
  QUEUED: 'text-muted-foreground',
  ERROR: 'text-red-500',
  CANCELED: 'text-muted-foreground',
}

function VercelSection({ slug }: { slug: string }) {
  const [connections, setConnections] = useState<VercelConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'idle' | 'token' | 'project'>('idle')
  const [tokenForm, setTokenForm] = useState({ accessToken: '', teamId: '' })
  const [lookupResult, setLookupResult] = useState<{
    user: { username: string; email: string }
    teams: { id: string; slug: string; name: string }[]
    projects: { id: string; name: string; framework: string | null }[]
  } | null>(null)
  const [looking, setLooking] = useState(false)
  const [selectedProject, setSelectedProject] = useState('')
  const [gitConnectionId, setGitConnectionId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [deployingId, setDeployingId] = useState<string | null>(null)
  const [deployments, setDeployments] = useState<Record<string, VercelDeployment[]>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [gitConnections, setGitConnections] = useState<{ id: string; provider: string; repoOwner: string; repoName: string }[]>([])

  useEffect(() => {
    Promise.all([
      api.vercel.list(slug).then(setConnections).catch(() => {}),
      api.git.list(slug).then(setGitConnections).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [slug])

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setLooking(true)
    try {
      const result = await api.vercel.lookupProjects(slug, {
        accessToken: tokenForm.accessToken,
        teamId: tokenForm.teamId || undefined,
      })
      setLookupResult(result)
      setStep('project')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Invalid token')
    } finally {
      setLooking(false)
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!lookupResult || !selectedProject) return
    setConnecting(true)
    try {
      const project = lookupResult.projects.find((p) => p.id === selectedProject)
      if (!project) return
      const team = tokenForm.teamId ? lookupResult.teams.find((t) => t.id === tokenForm.teamId) : null
      const conn = await api.vercel.connect(slug, {
        accessToken: tokenForm.accessToken,
        teamId: team?.id,
        teamSlug: team?.slug,
        teamName: team?.name,
        projectId: project.id,
        projectName: project.name,
        framework: project.framework ?? undefined,
        gitConnectionId: gitConnectionId || undefined,
      })
      setConnections((prev) => [conn, ...prev])
      setStep('idle')
      setTokenForm({ accessToken: '', teamId: '' })
      setLookupResult(null)
      setSelectedProject('')
      setGitConnectionId('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect(id: string) {
    await api.vercel.disconnect(slug, id)
    setConnections((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleDeploy(conn: VercelConnection) {
    setDeployingId(conn.id)
    try {
      const { deployment } = await api.vercel.deploy(slug, conn.id)
      alert(`Deployment triggered: ${deployment.url ?? deployment.uid} (${deployment.state})`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Deploy failed')
    } finally {
      setDeployingId(null)
    }
  }

  async function handleLoadDeployments(conn: VercelConnection) {
    if (expandedId === conn.id) { setExpandedId(null); return }
    setExpandedId(conn.id)
    if (deployments[conn.id]) return
    try {
      const { deployments: list } = await api.vercel.deployments(slug, conn.id)
      setDeployments((prev) => ({ ...prev, [conn.id]: list }))
    } catch {}
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium flex items-center gap-2">
          <Triangle className="h-4 w-4 text-muted-foreground" />
          Vercel
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect Vercel projects to monitor deployments and trigger deploys from the agent
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : (
        <>
          {connections.length > 0 && (
            <div className="space-y-2">
              {connections.map((conn) => (
                <div key={conn.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {conn.teamName && (
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">
                          {conn.teamName}
                        </span>
                      )}
                      <span className="text-sm font-medium truncate">{conn.projectName}</span>
                      {conn.framework && (
                        <span className="text-xs text-muted-foreground shrink-0">{conn.framework}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleDeploy(conn)}
                        disabled={deployingId === conn.id}
                        title="Trigger deployment"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {deployingId === conn.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RefreshCw className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleLoadDeployments(conn)}
                        title="View deployments"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDisconnect(conn.id)}
                        title="Disconnect"
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Unplug className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {conn.gitConnectionId && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      Linked to git repo
                    </p>
                  )}

                  {expandedId === conn.id && (
                    <div className="border-t border-border pt-2 space-y-1">
                      {!deployments[conn.id] ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading deployments...
                        </div>
                      ) : deployments[conn.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground">No deployments yet</p>
                      ) : (
                        deployments[conn.id].slice(0, 5).map((d) => (
                          <div key={d.uid} className="flex items-center justify-between text-xs">
                            <span className={DEPLOYMENT_STATE_COLOR[d.state] ?? 'text-muted-foreground'}>
                              {d.state}
                            </span>
                            <span className="text-muted-foreground">{d.target ?? 'preview'}</span>
                            <span className="text-muted-foreground font-mono truncate max-w-[120px]">{d.url}</span>
                            <span className="text-muted-foreground">
                              {new Date(d.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 'idle' && (
            <button
              onClick={() => setStep('token')}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors w-full justify-center"
            >
              <Plus className="h-3.5 w-3.5" /> Connect Vercel account
            </button>
          )}

          {step === 'token' && (
            <form onSubmit={handleLookup} className="rounded-lg border border-dashed border-border p-4 space-y-3">
              <p className="text-sm font-medium">Step 1 — Enter your Vercel token</p>
              <input
                required
                type="password"
                placeholder="Vercel API token"
                value={tokenForm.accessToken}
                onChange={(e) => setTokenForm((f) => ({ ...f, accessToken: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                placeholder="Team ID (optional — leave blank for personal account)"
                value={tokenForm.teamId}
                onChange={(e) => setTokenForm((f) => ({ ...f, teamId: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={looking}
                  className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
                >
                  {looking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Load projects
                </button>
                <button type="button" onClick={() => setStep('idle')} className="text-sm text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {step === 'project' && lookupResult && (
            <form onSubmit={handleConnect} className="rounded-lg border border-border p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Step 2 — Select a project</p>
                <p className="text-xs text-muted-foreground mt-0.5">Signed in as {lookupResult.user.username} ({lookupResult.user.email})</p>
              </div>

              <select
                required
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a project…</option>
                {lookupResult.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.framework ? ` (${p.framework})` : ''}
                  </option>
                ))}
              </select>

              {gitConnections.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Link to git repo (optional)</label>
                  <select
                    value={gitConnectionId}
                    onChange={(e) => setGitConnectionId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">No link</option>
                    {gitConnections.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.provider} · {g.repoOwner}/{g.repoName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={connecting || !selectedProject}
                  className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50"
                >
                  {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Connect project
                </button>
                <button type="button" onClick={() => { setStep('token'); setLookupResult(null) }} className="text-sm text-muted-foreground hover:text-foreground">
                  Back
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  )
}

// ── Telegram Section ──────────────────────────────────────────────────────────

function TelegramSection({ slug }: { slug: string }) {
  const [connections, setConnections] = useState<TelegramConnection[]>([])
  const [connectCode, setConnectCode] = useState<{ code: string; botUsername: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.integrations.telegramStatus(slug).then((res) => {
      setConnections(res.connections)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [slug])

  async function handleGenerateCode() {
    setGenerating(true)
    try {
      const res = await api.integrations.telegramConnectCode(slug)
      setConnectCode(res)
    } finally {
      setGenerating(false)
    }
  }

  async function handleDisconnect(id: string) {
    await api.integrations.telegramDisconnect(slug, id)
    setConnections((prev) => prev.filter((c) => c.id !== id))
  }

  async function copyCommand() {
    if (!connectCode) return
    await navigator.clipboard.writeText(`/connect ${connectCode.code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium flex items-center gap-2">
          <span>Telegram</span>
          {connections.length > 0 && (
            <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
              Connected
            </span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Chat with your coworker directly from Telegram
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : connections.length > 0 ? (
        <div className="space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border"
            >
              <div>
                <p className="text-sm font-medium">
                  {conn.telegramUsername ? `@${conn.telegramUsername}` : 'Telegram chat'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Connected {new Date(conn.connectedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDisconnect(conn.id)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Disconnect
              </button>
            </div>
          ))}
          <button
            onClick={handleGenerateCode}
            disabled={generating}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            + Connect another account
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No Telegram accounts connected yet</p>
          <button
            onClick={handleGenerateCode}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Connect Telegram
          </button>
        </div>
      )}

      {connectCode && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Connect via Telegram</p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Open Telegram and search for <strong>@{connectCode.botUsername}</strong></li>
            <li>Send the command below to the bot:</li>
          </ol>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-background border border-input px-3 py-2 text-sm font-mono">
              /connect {connectCode.code}
            </code>
            <button
              onClick={copyCommand}
              className="shrink-0 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">This code expires in 10 minutes.</p>
        </div>
      )}
    </section>
  )
}

// ── Files Section ─────────────────────────────────────────────────────────────

function ExtractionStatusBadge({ status }: { status: WorkspaceFile['extractionStatus'] }) {
  if (status === 'extracted') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-full">
        <CheckCircle2 className="h-3 w-3" /> Ready
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full">
        <Loader2 className="h-3 w-3 animate-spin" /> Processing
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">
        <AlertCircle className="h-3 w-3" /> Failed
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
      <Clock className="h-3 w-3" /> Pending
    </span>
  )
}

function FilePreviewModal({ file, slug, onClose }: { file: WorkspaceFile; slug: string; onClose: () => void }) {
  const [content, setContent] = useState<ExtractedFileContent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.integrations.getExtractedText(slug, file.id)
      .then(setContent)
      .catch(() => setContent(null))
      .finally(() => setLoading(false))
  }, [slug, file.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative bg-background rounded-xl border border-border shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm truncate">{file.name}</span>
            <ExtractionStatusBadge status={file.extractionStatus} />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 ml-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading extracted content...
            </div>
          ) : !content || content.chunks.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {file.extractionStatus === 'pending' || file.extractionStatus === 'processing'
                ? 'Content is still being extracted. Check back in a moment.'
                : file.extractionStatus === 'failed'
                ? 'Extraction failed for this file.'
                : 'No text content found in this file.'}
            </div>
          ) : (
            <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {content.chunks.map((c) => c.content).join('\n\n---\n\n')}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

function FilesSection({ slug }: { slug: string }) {
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    api.integrations.listFiles(slug).then((f) => {
      setFiles(f)
      setLoading(false)
    }).catch(() => setLoading(false))
    api.workspaces.get(slug).then((ws) => setWorkspaceId(ws.id))
  }, [slug])

  // Subscribe to extraction status updates
  useEffect(() => {
    if (!workspaceId || !token) return

    const socket = new WorkspaceSocket(workspaceId, token)
    socket.connect()

    const unsub = socket.on((event) => {
      if (event.type === 'file:extraction_status') {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === event.fileId
              ? { ...f, extractionStatus: event.status as WorkspaceFile['extractionStatus'] }
              : f
          )
        )
        setPreviewFile((prev) =>
          prev?.id === event.fileId
            ? { ...prev, extractionStatus: event.status as WorkspaceFile['extractionStatus'] }
            : prev
        )
      }
    })

    return () => {
      unsub()
      socket.disconnect()
    }
  }, [workspaceId, token])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const uploaded = await api.integrations.uploadFile(slug, file)
      setFiles((prev) => [uploaded, ...prev])
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(fileId: string) {
    await api.integrations.deleteFile(slug, fileId)
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    if (previewFile?.id === fileId) setPreviewFile(null)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Files</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload documents your coworker can reference
          </p>
        </div>
        <label className={`flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm cursor-pointer hover:bg-accent transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Upload
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.gif,.webp"
            onChange={handleUpload}
          />
        </label>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Paperclip className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No files uploaded yet</p>
          <p className="text-xs text-muted-foreground mt-1">PDFs, images, and text files up to 25 MB</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border group"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <ExtractionStatusBadge status={file.extractionStatus} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {file.mimeType ?? 'unknown'} · {file.sizeBytes ? formatBytes(file.sizeBytes) : '?'}
                  {' · '}{new Date(file.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                {file.extractionStatus === 'extracted' && (
                  <button
                    onClick={() => setPreviewFile(file)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Preview extracted text"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(file.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          slug={slug}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </section>
  )
}

// ── Skills Section ────────────────────────────────────────────────────────────

function SkillsSection({ slug }: { slug: string }) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', prompt: '', triggerPhrase: '' })

  useEffect(() => {
    api.skills.list(slug).then(setSkills)
  }, [slug])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const skill = await api.skills.create(slug, { ...form, tools: [], isActive: true })
    setSkills((prev) => [...prev, skill])
    setCreating(false)
    setForm({ name: '', description: '', prompt: '', triggerPhrase: '' })
  }

  async function handleToggle(skill: Skill) {
    const updated = await api.skills.update(slug, skill.id, { isActive: !skill.isActive })
    setSkills((prev) => prev.map((s) => (s.id === skill.id ? updated : s)))
  }

  async function handleDelete(id: string) {
    await api.skills.delete(slug, id)
    setSkills((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Skills</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Extend your coworker&apos;s behaviour with custom prompts
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add skill
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="border border-border rounded-lg p-4 space-y-3">
          <input
            required
            placeholder="Skill name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            placeholder="Trigger phrase (e.g. /report)"
            value={form.triggerPhrase}
            onChange={(e) => setForm((f) => ({ ...f, triggerPhrase: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            required
            rows={4}
            placeholder="System prompt addition for this skill..."
            value={form.prompt}
            onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium">
              Save
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {skills.length === 0 && !creating ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No skills yet</p>
        ) : (
          skills.map((skill) => (
            <div key={skill.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{skill.name}</p>
                  {skill.triggerPhrase && (
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                      {skill.triggerPhrase}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{skill.prompt}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => handleToggle(skill)} className="text-muted-foreground hover:text-foreground">
                  {skill.isActive ? (
                    <ToggleRight className="h-5 w-5 text-primary" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
                <button onClick={() => handleDelete(skill.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
