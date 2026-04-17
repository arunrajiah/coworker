'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Moon, Clock, Zap, ChevronDown, Play, Trash2,
  CheckSquare, MessageSquare, Calendar, ToggleLeft, ToggleRight,
  Loader2, Pencil,
} from 'lucide-react'
import { api, type AutopilotRule, type AutopilotTrigger, type AutopilotAction } from '@/lib/api'
import { cn } from '@/lib/utils'

const CRON_PRESETS = [
  { label: 'Every morning (9 am)', value: '0 9 * * *' },
  { label: 'Every Monday at 9 am', value: '0 9 * * 1' },
  { label: 'Every Friday at 5 pm', value: '0 17 * * 5' },
  { label: 'Weekdays at 9 am', value: '0 9 * * 1-5' },
  { label: 'Every Sunday at 8 pm', value: '0 20 * * 0' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Custom…', value: 'custom' },
]

const TRIGGER_LABELS: Record<AutopilotTrigger, string> = {
  schedule: 'Schedule',
  task_created: 'Task created',
  task_status_changed: 'Task status changed',
  message_received: 'Message received',
}

const ACTION_LABELS: Record<AutopilotAction, string> = {
  run_agent: 'Run agent with prompt',
  create_task: 'Create a task',
  send_message: 'Send a message',
  call_webhook: 'Call a webhook',
}

const TRIGGER_ICONS: Record<AutopilotTrigger, React.ReactNode> = {
  schedule: <Calendar className="h-3.5 w-3.5" />,
  task_created: <CheckSquare className="h-3.5 w-3.5" />,
  task_status_changed: <Zap className="h-3.5 w-3.5" />,
  message_received: <MessageSquare className="h-3.5 w-3.5" />,
}

interface RuleForm {
  name: string
  description: string
  triggerType: AutopilotTrigger
  cronPreset: string
  cronCustom: string
  actionType: AutopilotAction
  agentPrompt: string
  taskTitle: string
  taskPriority: string
}

const DEFAULT_FORM: RuleForm = {
  name: '',
  description: '',
  triggerType: 'schedule',
  cronPreset: '0 9 * * 1',
  cronCustom: '',
  actionType: 'run_agent',
  agentPrompt: '',
  taskTitle: '',
  taskPriority: 'medium',
}

function cronLabel(cron: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === cron)
  return preset && preset.value !== 'custom' ? preset.label : cron
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function ruleToForm(rule: AutopilotRule): RuleForm {
  const cron = (rule.triggerConfig as { cron?: string }).cron ?? '0 9 * * 1'
  const isPreset = CRON_PRESETS.some((p) => p.value === cron && p.value !== 'custom')
  return {
    name: rule.name,
    description: rule.description ?? '',
    triggerType: rule.triggerType,
    cronPreset: isPreset ? cron : 'custom',
    cronCustom: isPreset ? '' : cron,
    actionType: rule.actionType,
    agentPrompt: ((rule.actionConfig as { prompt?: string }).prompt) ?? '',
    taskTitle: ((rule.actionConfig as { title?: string }).title) ?? '',
    taskPriority: ((rule.actionConfig as { priority?: string }).priority) ?? 'medium',
  }
}

export default function AutopilotPage() {
  const params = useParams()
  const slug = params.slug as string

  const [rules, setRules] = useState<AutopilotRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AutopilotRule | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    api.autopilot.list(slug).then(setRules).finally(() => setLoading(false))
  }, [slug])

  async function handleToggle(rule: AutopilotRule) {
    setSavingId(rule.id)
    const updated = await api.autopilot.update(slug, rule.id, { isActive: !rule.isActive })
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)))
    setSavingId(null)
  }

  async function handleDelete(id: string) {
    await api.autopilot.delete(slug, id)
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  async function handleRunNow(id: string) {
    setRunningId(id)
    await api.autopilot.run(slug, id).catch(() => {})
    setRunningId(null)
  }

  async function handleSave(form: RuleForm) {
    const cron = form.cronPreset === 'custom' ? form.cronCustom : form.cronPreset
    const triggerConfig = form.triggerType === 'schedule' ? { cron } : {}
    const actionConfig =
      form.actionType === 'run_agent'
        ? { prompt: form.agentPrompt }
        : form.actionType === 'create_task'
        ? { title: form.taskTitle, priority: form.taskPriority }
        : {}

    const payload = {
      name: form.name,
      description: form.description || undefined,
      triggerType: form.triggerType,
      triggerConfig,
      actionType: form.actionType,
      actionConfig,
    }

    if (editingRule) {
      const updated = await api.autopilot.update(slug, editingRule.id, payload)
      setRules((prev) => prev.map((r) => (r.id === editingRule.id ? updated : r)))
    } else {
      const created = await api.autopilot.create(slug, payload)
      setRules((prev) => [created, ...prev])
    }

    setShowForm(false)
    setEditingRule(null)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Autopilot</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Rules that run your coworker automatically — on a schedule or triggered by events
            </p>
          </div>
          <button
            onClick={() => { setEditingRule(null); setShowForm(true) }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New rule
          </button>
        </div>

        {showForm && (
          <RuleFormPanel
            initial={editingRule ? ruleToForm(editingRule) : DEFAULT_FORM}
            isEdit={!!editingRule}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingRule(null) }}
          />
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : rules.length === 0 && !showForm ? (
          <EmptyState onNew={() => setShowForm(true)} />
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                running={runningId === rule.id}
                saving={savingId === rule.id}
                onToggle={() => handleToggle(rule)}
                onRunNow={() => handleRunNow(rule.id)}
                onEdit={() => {
                  setEditingRule(rule)
                  setShowForm(true)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                onDelete={() => handleDelete(rule.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RuleFormPanel({
  initial,
  isEdit,
  onSave,
  onCancel,
}: {
  initial: RuleForm
  isEdit: boolean
  onSave: (form: RuleForm) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<RuleForm>(initial)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof RuleForm>(key: K, value: RuleForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(form).catch(() => {})
    setSaving(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-background p-5 space-y-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold">{isEdit ? `Edit: ${initial.name}` : 'New autopilot rule'}</h2>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <input
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Weekly planning briefing"
          className="w-full rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Trigger</label>
          <div className="relative">
            <select
              value={form.triggerType}
              onChange={(e) => set('triggerType', e.target.value as AutopilotTrigger)}
              className="w-full appearance-none rounded-lg border border-input bg-muted/40 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(Object.keys(TRIGGER_LABELS) as AutopilotTrigger[]).map((t) => (
                <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {form.triggerType === 'schedule' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Schedule</label>
            <div className="relative">
              <select
                value={form.cronPreset}
                onChange={(e) => set('cronPreset', e.target.value)}
                className="w-full appearance-none rounded-lg border border-input bg-muted/40 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CRON_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {form.triggerType === 'schedule' && form.cronPreset === 'custom' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cron expression</label>
          <input
            value={form.cronCustom}
            onChange={(e) => set('cronCustom', e.target.value)}
            placeholder="0 9 * * 1"
            className="w-full rounded-lg border border-input bg-muted/40 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Standard 5-field cron (minute hour day month weekday)</p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Action</label>
        <div className="relative">
          <select
            value={form.actionType}
            onChange={(e) => set('actionType', e.target.value as AutopilotAction)}
            className="w-full appearance-none rounded-lg border border-input bg-muted/40 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(Object.keys(ACTION_LABELS) as AutopilotAction[]).map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {form.actionType === 'run_agent' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Agent prompt</label>
          <textarea
            required
            rows={3}
            value={form.agentPrompt}
            onChange={(e) => set('agentPrompt', e.target.value)}
            placeholder="Review all in-progress tasks and give me a brief summary of blockers and progress."
            className="w-full rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
      )}

      {form.actionType === 'create_task' && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Task title</label>
            <input
              required
              value={form.taskTitle}
              onChange={(e) => set('taskTitle', e.target.value)}
              placeholder="Weekly review"
              className="w-full rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <div className="relative">
              <select
                value={form.taskPriority}
                onChange={(e) => set('taskPriority', e.target.value)}
                className="w-full appearance-none rounded-lg border border-input bg-muted/40 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {['low', 'medium', 'high', 'urgent'].map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save rule
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function RuleCard({
  rule,
  running,
  saving,
  onToggle,
  onRunNow,
  onEdit,
  onDelete,
}: {
  rule: AutopilotRule
  running: boolean
  saving: boolean
  onToggle: () => void
  onRunNow: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const cron = (rule.triggerConfig as { cron?: string }).cron
  const prompt = (rule.actionConfig as { prompt?: string }).prompt
  const taskTitle = (rule.actionConfig as { title?: string }).title

  return (
    <div className={cn('rounded-xl border border-border bg-background p-4 transition-opacity', !rule.isActive && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Moon className="h-4 w-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{rule.name}</span>
            <span className={cn(
              'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full',
              rule.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            )}>
              {TRIGGER_ICONS[rule.triggerType]}
              {rule.triggerType === 'schedule' && cron ? cronLabel(cron) : TRIGGER_LABELS[rule.triggerType]}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {ACTION_LABELS[rule.actionType]}
            </span>
          </div>

          {(prompt || taskTitle) && (
            <p className="text-xs text-muted-foreground mt-1 truncate max-w-lg">{prompt ?? taskTitle}</p>
          )}

          <p className="text-xs text-muted-foreground mt-1">Last run: {relativeTime(rule.lastRunAt)}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRunNow}
            disabled={running}
            title="Run now"
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onToggle}
            disabled={saving}
            title={rule.isActive ? 'Disable' : 'Enable'}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : rule.isActive
              ? <ToggleRight className="h-4 w-4 text-primary" />
              : <ToggleLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-4">
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
        <Moon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium">No autopilot rules yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          Rules run your coworker on a schedule or when something happens — without you having to ask.
        </p>
      </div>
      <div className="space-y-2 text-left max-w-sm mx-auto">
        {[
          { icon: '📋', text: 'Every Monday: brief me on what\'s in progress' },
          { icon: '📊', text: 'Every Friday: summarise completed work this week' },
          { icon: '⚡', text: 'On task created: check for blockers and dependencies' },
        ].map((ex) => (
          <div key={ex.text} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{ex.icon}</span><span>{ex.text}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Create first rule
      </button>
    </div>
  )
}
