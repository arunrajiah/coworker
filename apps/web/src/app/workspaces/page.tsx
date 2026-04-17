'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, type Workspace } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { FOUNDER_TEMPLATES } from '@coworker/core'
import type { TemplateType } from '@coworker/core'
import { cn } from '@/lib/utils'
import { ChevronRight, CheckCircle2 } from 'lucide-react'

const TEMPLATE_ICONS: Record<TemplateType, string> = {
  saas: '🚀',
  agency: '🎯',
  ecommerce: '🛒',
  consulting: '💼',
  freelancer: '⚡',
  general: '✦',
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [step, setStep] = useState<'list' | 'create'>('list')
  const [name, setName] = useState('')
  const [templateType, setTemplateType] = useState<TemplateType | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const { token, user } = useAuthStore()

  useEffect(() => {
    if (!token) {
      router.replace('/login')
      return
    }
    api.workspaces
      .list()
      .then((ws) => {
        setWorkspaces(ws)
        // If they have workspaces, go straight to the list
        if (ws.length === 0) setStep('create')
      })
      .finally(() => setLoading(false))
  }, [token])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!templateType) return
    setCreating(true)
    try {
      const ws = await api.workspaces.create({ name, templateType })
      router.push(`/w/${ws.slug}/chat`)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  // Existing workspace list
  if (step === 'list' && workspaces.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-4 py-16 space-y-8">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Welcome back{user?.name ? `, ${user.name}` : ''}</p>
            <h1 className="text-2xl font-semibold">Your workspaces</h1>
          </div>

          <div className="space-y-2">
            {workspaces.map((ws) => {
              const template = FOUNDER_TEMPLATES[ws.templateType as TemplateType]
              return (
                <button
                  key={ws.id}
                  onClick={() => router.push(`/w/${ws.slug}/chat`)}
                  className="w-full text-left flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-accent/30 transition-all group"
                >
                  <span className="text-2xl">{TEMPLATE_ICONS[ws.templateType as TemplateType] ?? '✦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{ws.name}</p>
                    <p className="text-sm text-muted-foreground">{template?.name ?? ws.templateType}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setStep('create')}
            className="w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-foreground hover:border-border/60 hover:bg-accent/20 transition-colors"
          >
            + Add another workspace
          </button>
        </div>
      </div>
    )
  }

  // New workspace creation — template picker first
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-10">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-4xl mb-4">🤝</div>
          <h1 className="text-2xl font-semibold">Meet your new coworker</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            They&apos;ll manage tasks, remember your context, and keep working while you sleep.
            First — what kind of work do you do?
          </p>
        </div>

        {/* Template picker */}
        {!templateType ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.values(FOUNDER_TEMPLATES).map((t) => (
              <button
                key={t.type}
                onClick={() => {
                  setTemplateType(t.type)
                  // Pre-fill name based on template
                  if (!name) setName('')
                }}
                className="flex flex-col items-start gap-2 rounded-xl border border-border p-4 hover:border-primary/40 hover:bg-accent/30 transition-all text-left group"
              >
                <span className="text-2xl">{TEMPLATE_ICONS[t.type]}</span>
                <div>
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selected template confirmation */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
              <span className="text-2xl">{TEMPLATE_ICONS[templateType]}</span>
              <div className="flex-1">
                <p className="font-medium text-sm">{FOUNDER_TEMPLATES[templateType].name}</p>
                <p className="text-xs text-muted-foreground">
                  {FOUNDER_TEMPLATES[templateType].description}
                </p>
              </div>
              <button
                onClick={() => setTemplateType(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Change
              </button>
            </div>

            {/* What they get */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Your coworker comes with
              </p>
              <div className="space-y-1.5">
                {FOUNDER_TEMPLATES[templateType].defaultSkills.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{s.name}</span>
                    {s.triggerPhrase && (
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {s.triggerPhrase}
                      </span>
                    )}
                  </div>
                ))}
                {FOUNDER_TEMPLATES[templateType].defaultAutopilotRules.map((r) => (
                  <div key={r.name} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{r.name}</span>
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      automated
                    </span>
                  </div>
                ))}
                {FOUNDER_TEMPLATES[templateType].defaultSkills.length === 0 &&
                  FOUNDER_TEMPLATES[templateType].defaultAutopilotRules.length === 0 && (
                    <p className="text-sm text-muted-foreground">Standard coworker setup — add skills as you go.</p>
                  )}
              </div>
            </div>

            {/* Workspace name */}
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  What&apos;s the name of your workspace?
                </label>
                <input
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    templateType === 'saas'
                      ? 'e.g. Acme SaaS'
                      : templateType === 'agency'
                        ? 'e.g. Studio Work'
                        : 'e.g. My Business'
                  }
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Setting up your coworker…' : 'Start working together →'}
              </button>
            </form>
          </div>
        )}

        {workspaces.length > 0 && (
          <div className="text-center">
            <button
              onClick={() => setStep('list')}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              ← Back to workspaces
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
