'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Moon, Plus, Trash2, ToggleLeft, ToggleRight, Clock, Zap, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface AutopilotRule {
  id: string
  name: string
  description: string | null
  triggerType: string
  triggerConfig: Record<string, unknown>
  actionType: string
  actionConfig: Record<string, unknown>
  isActive: boolean
  lastRunAt: string | null
  createdAt: string
}

const TRIGGER_LABELS: Record<string, string> = {
  schedule: 'On a schedule',
  task_created: 'When a task is created',
  task_status_changed: 'When a task status changes',
  message_received: 'When a message arrives',
}

const ACTION_LABELS: Record<string, string> = {
  run_agent: 'Ask your coworker to',
  create_task: 'Create a task',
  send_message: 'Send you a message',
  call_webhook: 'Call a webhook',
}

const CRON_PRESETS = [
  { label: 'Every morning at 9am', value: '0 9 * * *' },
  { label: 'Monday mornings', value: '0 9 * * MON' },
  { label: 'Friday afternoons', value: '0 16 * * FRI' },
  { label: 'Every weekday at 9am', value: '0 9 * * MON-FRI' },
  { label: 'First of the month', value: '0 9 1 * *' },
  { label: 'Custom (cron expression)', value: 'custom' },
]

export default function AutopilotPage() {
  const params = useParams()
  const slug = params.slug as string

  const [rules, setRules] = useState<AutopilotRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)

  const [form, setForm] = useState({
    name: '',
    triggerType: 'schedule',
    cronPreset: '0 9 * * MON',
    customCron: '',
    actionType: 'run_agent',
    actionPrompt: '',
    actionTaskTitle: '',
  })

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/workspaces/${slug}/autopilot`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then((r) => r.json())
      .then(setRules)
      .finally(() => setLoading(false))
  }, [slug])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    const cron = form.cronPreset === 'custom' ? form.customCron : form.cronPreset
    const triggerConfig = form.triggerType === 'schedule' ? { cron } : {}
    const actionConfig =
      form.actionType === 'run_agent'
        ? { prompt: form.actionPrompt }
        : { title: form.actionTaskTitle }

    const token = localStorage.getItem('token')
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/workspaces/${slug}/autopilot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          triggerType: form.triggerType,
          triggerConfig,
          actionType: form.actionType,
          actionConfig,
          isActive: true,
        }),
      }
    )
    const rule = await res.json()
    setRules((prev) => [rule, ...prev])
    setShowBuilder(false)
    setForm({
      name: '',
      triggerType: 'schedule',
      cronPreset: '0 9 * * MON',
      customCron: '',
      actionType: 'run_agent',
      actionPrompt: '',
      actionTaskTitle: '',
    })
  }

  async function handleToggle(rule: AutopilotRule) {
    const token = localStorage.getItem('token')
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/workspaces/${slug}/autopilot/${rule.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !rule.isActive }),
      }
    )
    const updated = await res.json()
    setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)))
  }

  async function handleDelete(id: string) {
    const token = localStorage.getItem('token')
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/workspaces/${slug}/autopilot/${id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    )
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  function describeTrigger(rule: AutopilotRule): string {
    if (rule.triggerType === 'schedule') {
      const cron = (rule.triggerConfig as { cron?: string }).cron
      const preset = CRON_PRESETS.find((p) => p.value === cron)
      return preset ? preset.label : `cron: ${cron}`
    }
    return TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType
  }

  function describeAction(rule: AutopilotRule): string {
    if (rule.actionType === 'run_agent') {
      const prompt = (rule.actionConfig as { prompt?: string }).prompt ?? ''
      return prompt.length > 60 ? prompt.slice(0, 60) + '…' : prompt
    }
    if (rule.actionType === 'create_task') {
      return `Create task: "${(rule.actionConfig as { title?: string }).title}"`
    }
    return rule.actionType
  }

  const activeRules = rules.filter((r) => r.isActive)
  const inactiveRules = rules.filter((r) => !r.isActive)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Autopilot</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Your coworker keeps working while you&apos;re away. Set up triggers and it handles the rest.
          </p>
        </div>

        {/* Active rules */}
        {!loading && activeRules.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Running</h2>
            {activeRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                trigger={describeTrigger(rule)}
                action={describeAction(rule)}
                onToggle={() => handleToggle(rule)}
                onDelete={() => handleDelete(rule.id)}
              />
            ))}
          </section>
        )}

        {/* Empty state */}
        {!loading && rules.length === 0 && !showBuilder && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
            <Moon className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium">No automations yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add one and your coworker will work while you sleep.
              </p>
            </div>
            <button
              onClick={() => setShowBuilder(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Create your first automation
            </button>
          </div>
        )}

        {/* Add button */}
        {!showBuilder && rules.length > 0 && (
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add automation
          </button>
        )}

        {/* Rule builder */}
        {showBuilder && (
          <form
            onSubmit={handleCreate}
            className="rounded-xl border border-border bg-card p-5 space-y-5"
          >
            <h2 className="font-medium text-sm">New automation</h2>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</label>
              <input
                required
                placeholder="e.g. Monday briefing"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Trigger */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">When</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, triggerType: val }))}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors',
                      form.triggerType === val
                        ? 'border-primary bg-primary/5 text-primary font-medium'
                        : 'border-border hover:bg-accent'
                    )}
                  >
                    {val === 'schedule' && <Clock className="h-3.5 w-3.5 shrink-0" />}
                    {val !== 'schedule' && <Zap className="h-3.5 w-3.5 shrink-0" />}
                    {label}
                  </button>
                ))}
              </div>

              {form.triggerType === 'schedule' && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {CRON_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, cronPreset: p.value }))}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-xs text-left transition-colors',
                          form.cronPreset === p.value
                            ? 'border-primary bg-primary/5 text-primary font-medium'
                            : 'border-border hover:bg-accent text-muted-foreground'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {form.cronPreset === 'custom' && (
                    <input
                      placeholder="Cron expression (e.g. 0 9 * * MON)"
                      value={form.customCron}
                      onChange={(e) => setForm((f) => ({ ...f, customCron: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex-1 border-t border-dashed border-border" />
              <ChevronRight className="h-4 w-4" />
              <div className="flex-1 border-t border-dashed border-border" />
            </div>

            {/* Action */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Then</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ACTION_LABELS)
                  .filter(([v]) => v !== 'call_webhook')
                  .map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, actionType: val }))}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-sm text-left transition-colors',
                        form.actionType === val
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-border hover:bg-accent'
                      )}
                    >
                      {label}
                    </button>
                  ))}
              </div>

              {form.actionType === 'run_agent' && (
                <textarea
                  required
                  rows={3}
                  placeholder="What should your coworker do? e.g. 'Give me a Monday briefing — open tasks, blockers, and top priorities for the week.'"
                  value={form.actionPrompt}
                  onChange={(e) => setForm((f) => ({ ...f, actionPrompt: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}

              {form.actionType === 'create_task' && (
                <input
                  required
                  placeholder="Task title to create"
                  value={form.actionTaskTitle}
                  onChange={(e) => setForm((f) => ({ ...f, actionTaskTitle: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Create automation
              </button>
              <button
                type="button"
                onClick={() => setShowBuilder(false)}
                className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Inactive rules */}
        {inactiveRules.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Paused</h2>
            {inactiveRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                trigger={describeTrigger(rule)}
                action={describeAction(rule)}
                onToggle={() => handleToggle(rule)}
                onDelete={() => handleDelete(rule.id)}
                dimmed
              />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

function RuleCard({
  rule,
  trigger,
  action,
  onToggle,
  onDelete,
  dimmed,
}: {
  rule: AutopilotRule
  trigger: string
  action: string
  onToggle: () => void
  onDelete: () => void
  dimmed?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border p-4 flex items-start gap-4 transition-opacity',
        dimmed && 'opacity-50'
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium">{rule.name}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="bg-secondary px-2 py-0.5 rounded-full">{trigger}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate">{action}</span>
        </div>
        {rule.lastRunAt && (
          <p className="text-xs text-muted-foreground">
            Last ran {new Date(rule.lastRunAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors">
          {rule.isActive ? (
            <ToggleRight className="h-5 w-5 text-primary" />
          ) : (
            <ToggleLeft className="h-5 w-5" />
          )}
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
