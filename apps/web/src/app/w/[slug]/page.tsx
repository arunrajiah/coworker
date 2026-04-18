'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Bot, Kanban, ListTodo, TrendingUp, Zap, Activity, ChevronRight, GitBranch, Sparkles, Moon, CheckCircle2, X } from 'lucide-react'
import { api, type Task, type TaskDomain } from '@/lib/api'
import { WorkspaceSocket } from '@/lib/ws'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

const DOMAIN_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  development: { label: 'Development', icon: '⚙️', color: 'bg-blue-500' },
  qa:          { label: 'QA',          icon: '🧪', color: 'bg-orange-500' },
  marketing:   { label: 'Marketing',   icon: '📣', color: 'bg-pink-500' },
  finance:     { label: 'Finance',     icon: '💰', color: 'bg-green-500' },
  design:      { label: 'Design',      icon: '🎨', color: 'bg-violet-500' },
  operations:  { label: 'Operations',  icon: '🔧', color: 'bg-amber-500' },
  hr:          { label: 'HR',          icon: '👥', color: 'bg-teal-500' },
  legal:       { label: 'Legal',       icon: '⚖️', color: 'bg-gray-500' },
  sales:       { label: 'Sales',       icon: '📈', color: 'bg-cyan-500' },
  general:     { label: 'General',     icon: '📋', color: 'bg-slate-500' },
}

interface DomainStats {
  domain: TaskDomain
  total: number
  inProgress: number
  done: number
  progress: number
}

export default function WorkspaceDashboard() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const token = useAuthStore((s) => s.token)

  const [tasks, setTasks] = useState<Task[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [agentRunning, setAgentRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasGit, setHasGit] = useState(false)
  const [hasAutopilot, setHasAutopilot] = useState(false)
  const [hasSkills, setHasSkills] = useState(false)
  const [checklistDismissed, setChecklistDismissed] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(`checklist-dismissed-${slug}`)
    if (dismissed) setChecklistDismissed(true)
  }, [slug])

  useEffect(() => {
    api.workspaces.get(slug).then((ws) => {
      setWorkspaceId(ws.id)
      setWorkspaceName(ws.name)
    })
    api.tasks.list(slug).then((t) => {
      setTasks(t)
      setLoading(false)
    })
    api.git.list(slug).then((c) => setHasGit(c.length > 0)).catch(() => {})
    api.autopilot.list(slug).then((r) => setHasAutopilot(r.length > 0)).catch(() => {})
    api.skills.list(slug).then((s) => setHasSkills(s.length > 0)).catch(() => {})
  }, [slug])

  function dismissChecklist() {
    localStorage.setItem(`checklist-dismissed-${slug}`, '1')
    setChecklistDismissed(true)
  }

  const hasTasks = tasks.length > 0
  const checklistDone = hasTasks && hasGit && hasAutopilot && hasSkills

  useEffect(() => {
    if (!workspaceId || !token) return
    const socket = new WorkspaceSocket(workspaceId, token)
    socket.connect()

    const off = socket.on((event) => {
      if (event.type === 'task:created') {
        setTasks((prev) => [event.task, ...prev.filter((t) => t.id !== event.task.id)])
      } else if (event.type === 'task:updated') {
        setTasks((prev) => prev.map((t) => (t.id === event.task.id ? event.task : t)))
      } else if (event.type === 'task:deleted') {
        setTasks((prev) => prev.filter((t) => t.id !== event.taskId))
      } else if (event.type === 'agent:thinking') {
        setAgentRunning(true)
      } else if (event.type === 'agent:complete' || event.type === 'agent:error') {
        setAgentRunning(false)
      }
    })

    return () => { off(); socket.disconnect() }
  }, [workspaceId, token])

  const activeTasks = tasks.filter((t) => !['done', 'cancelled'].includes(t.status))
  const doneTasks = tasks.filter((t) => t.status === 'done')
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress')
  const agentTasks = tasks.filter((t) => t.agentOwned)

  // Domain breakdown
  const domainMap = new Map<TaskDomain, Task[]>()
  for (const task of tasks) {
    if (!domainMap.has(task.domain)) domainMap.set(task.domain, [])
    domainMap.get(task.domain)!.push(task)
  }
  const domainStats: DomainStats[] = Array.from(domainMap.entries())
    .map(([domain, dtasks]) => {
      const total = dtasks.length
      const done = dtasks.filter((t) => t.status === 'done').length
      const inProgress = dtasks.filter((t) => t.status === 'in_progress').length
      return { domain, total, inProgress, done, progress: total > 0 ? Math.round((done / total) * 100) : 0 }
    })
    .sort((a, b) => b.total - a.total)

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{workspaceName || 'Dashboard'}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Overview of all work across every domain</p>
          </div>
          {agentRunning && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-1.5 rounded-full">
              <Bot className="h-4 w-4" />
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </span>
              Agent working
            </div>
          )}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={<ListTodo className="h-4 w-4" />} label="Active tasks" value={activeTasks.length} color="text-blue-600" />
          <KpiCard icon={<Activity className="h-4 w-4" />} label="In progress" value={inProgressTasks.length} color="text-yellow-600" />
          <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Completed" value={doneTasks.length} color="text-green-600" />
          <KpiCard icon={<Zap className="h-4 w-4" />} label="AI-owned tasks" value={agentTasks.length} color="text-purple-600" />
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push(`/w/${slug}/board`)}
            className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-accent transition-colors text-left group"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Kanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Open Board</p>
              <p className="text-xs text-muted-foreground">Drag-and-drop kanban</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={() => router.push(`/w/${slug}/chat/new`)}
            className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-accent transition-colors text-left group"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Ask your coworker</p>
              <p className="text-xs text-muted-foreground">Plan work, get answers</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Getting started checklist */}
        {!checklistDismissed && !checklistDone && (
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Get started</p>
              <button
                onClick={dismissChecklist}
                className="text-muted-foreground hover:text-foreground transition-colors rounded p-0.5 hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              <ChecklistItem
                done={hasTasks}
                label="Ask your coworker to create some tasks"
                href={`/w/${slug}/chat/new`}
                icon={<Bot className="h-3.5 w-3.5" />}
                router={router}
              />
              <ChecklistItem
                done={hasGit}
                label="Connect a Git repository to sync issues"
                href={`/w/${slug}/settings`}
                icon={<GitBranch className="h-3.5 w-3.5" />}
                router={router}
              />
              <ChecklistItem
                done={hasSkills}
                label="Create a skill to extend your coworker"
                href={`/w/${slug}/skills`}
                icon={<Sparkles className="h-3.5 w-3.5" />}
                router={router}
              />
              <ChecklistItem
                done={hasAutopilot}
                label="Set up an autopilot rule to automate work"
                href={`/w/${slug}/autopilot`}
                icon={<Moon className="h-3.5 w-3.5" />}
                router={router}
              />
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Domain breakdown */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Work by domain</h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : domainStats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No tasks yet. Ask your coworker to plan some work.
              </div>
            ) : (
              <div className="space-y-2">
                {domainStats.map((stat) => {
                  const config = DOMAIN_CONFIG[stat.domain] ?? DOMAIN_CONFIG.general
                  return (
                    <button
                      key={stat.domain}
                      onClick={() => router.push(`/w/${slug}/board?domain=${stat.domain}`)}
                      className="w-full flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-accent transition-colors text-left group"
                    >
                      <span className="text-lg">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{config.label}</span>
                          <span className="text-xs text-muted-foreground">{stat.done}/{stat.total}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', config.color)}
                            style={{ width: `${stat.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{stat.progress}%</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Recent activity */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : recentTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No activity yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => router.push(`/w/${slug}/board`)}
                    className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent cursor-pointer transition-colors"
                  >
                    <StatusDot status={task.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{DOMAIN_CONFIG[task.domain]?.icon} {DOMAIN_CONFIG[task.domain]?.label ?? task.domain}</p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-2">
      <div className={cn('flex items-center gap-2 text-sm font-medium', color)}>
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    backlog: 'bg-slate-400', todo: 'bg-blue-400', in_progress: 'bg-yellow-400',
    review: 'bg-purple-400', done: 'bg-green-500', cancelled: 'bg-gray-300',
  }
  return <span className={cn('h-2 w-2 rounded-full shrink-0', colors[status] ?? 'bg-gray-300')} />
}

function ChecklistItem({
  done,
  label,
  href,
  icon,
  router,
}: {
  done: boolean
  label: string
  href: string
  icon: React.ReactNode
  router: ReturnType<typeof import('next/navigation').useRouter>
}) {
  return (
    <button
      onClick={() => !done && router.push(href)}
      disabled={done}
      className={cn(
        'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-left',
        done
          ? 'text-muted-foreground cursor-default'
          : 'hover:bg-accent cursor-pointer text-foreground'
      )}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
      )}
      <span className={cn('flex items-center gap-1.5', done && 'line-through')}>
        {icon}
        {label}
      </span>
      {!done && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    backlog: 'Backlog', todo: 'Todo', in_progress: 'In Progress',
    review: 'Review', done: 'Done', cancelled: 'Cancelled',
  }
  return <span className="text-xs text-muted-foreground shrink-0">{labels[status] ?? status}</span>
}
