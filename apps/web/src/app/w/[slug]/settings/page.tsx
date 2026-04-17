'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Trash2, ToggleLeft, ToggleRight, Send, CheckCircle2, Loader2, Paperclip, FileText, X } from 'lucide-react'
import { api, type Skill, type TelegramConnection, type WorkspaceFile } from '@/lib/api'

export default function SettingsPage() {
  const params = useParams()
  const slug = params.slug as string

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage integrations, skills, and workspace files</p>
        </div>

        <TelegramSection slug={slug} />
        <FilesSection slug={slug} />
        <SkillsSection slug={slug} />
      </div>
    </div>
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

function FilesSection({ slug }: { slug: string }) {
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.integrations.listFiles(slug).then((f) => {
      setFiles(f)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [slug])

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
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.mimeType ?? 'unknown'} · {file.sizeBytes ? formatBytes(file.sizeBytes) : '?'}
                  {' · '}{new Date(file.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(file.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
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
