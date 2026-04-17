'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Circle, ArrowUpCircle, CheckCircle2, XCircle, Bot } from 'lucide-react'
import { api, type Task } from '@/lib/api'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  open: { label: 'Open', icon: Circle, color: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: ArrowUpCircle, color: 'text-blue-500' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-green-500' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-muted-foreground' },
} as const

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

export default function TasksPage() {
  const params = useParams()
  const slug = params.slug as string

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('open')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    api.tasks
      .list(slug, filter !== 'all' ? { status: filter } : {})
      .then(setTasks)
      .finally(() => setLoading(false))
  }, [slug, filter])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const task = await api.tasks.create(slug, { title: newTitle })
    setTasks((prev) => [task, ...prev])
    setNewTitle('')
    setCreating(false)
  }

  async function handleStatusChange(taskId: string, status: Task['status']) {
    const updated = await api.tasks.update(slug, taskId, { status })
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)))
  }

  const grouped = tasks.reduce(
    (acc, task) => {
      const key = task.status
      if (!acc[key]) acc[key] = []
      acc[key].push(task)
      return acc
    },
    {} as Record<string, Task[]>
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tasks</h1>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New task
        </button>
      </div>

      {/* Filters */}
      <div className="border-b border-border px-6 py-2 flex gap-1">
        {['open', 'in_progress', 'done', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'px-3 py-1 rounded-md text-sm transition-colors',
              filter === s
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {creating && (
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
              Add
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center space-y-2 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 opacity-20" />
            <p className="text-sm">No tasks yet. Ask your coworker to create some.</p>
          </div>
        ) : (
          tasks.map((task) => {
            const StatusIcon = STATUS_CONFIG[task.status].icon
            return (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors group"
              >
                <button
                  onClick={() => {
                    const next: Record<Task['status'], Task['status']> = {
                      open: 'in_progress',
                      in_progress: 'done',
                      done: 'open',
                      cancelled: 'open',
                    }
                    handleStatusChange(task.id, next[task.status])
                  }}
                  className={cn('mt-0.5 shrink-0', STATUS_CONFIG[task.status].color)}
                >
                  <StatusIcon className="h-4.5 w-4.5" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', task.status === 'done' && 'line-through text-muted-foreground')}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[task.priority])}>
                      {task.priority}
                    </span>
                    {task.agentOwned && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Bot className="h-3 w-3" /> agent
                      </span>
                    )}
                    {task.labels.map((l) => (
                      <span key={l} className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                {task.dueDate && (
                  <span className="text-xs text-muted-foreground shrink-0">{task.dueDate}</span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
