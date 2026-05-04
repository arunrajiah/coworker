'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Plus, Circle, ArrowUpCircle, CheckCircle2, XCircle, Bot, Clock, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, type Task, type TaskStatus } from '@/lib/api'
import { cn, dueDateColor } from '@/lib/utils'
import { TaskDetailModal } from '@/components/TaskDetailModal'

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Circle; color: string }> = {
  backlog:     { label: 'Backlog',     icon: Circle,        color: 'text-slate-400' },
  todo:        { label: 'Todo',        icon: Clock,         color: 'text-blue-500' },
  in_progress: { label: 'In Progress', icon: ArrowUpCircle, color: 'text-yellow-500' },
  review:      { label: 'Review',      icon: Circle,        color: 'text-purple-500' },
  done:        { label: 'Done',        icon: CheckCircle2,  color: 'text-green-500' },
  cancelled:   { label: 'Cancelled',   icon: XCircle,       color: 'text-muted-foreground' },
}

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  backlog:     'todo',
  todo:        'in_progress',
  in_progress: 'review',
  review:      'done',
  done:        'backlog',
  cancelled:   'backlog',
}

const PRIORITY_COLORS = {
  low:    'bg-slate-100 text-slate-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const PAGE_SIZE = 25

const VALID_FILTERS = ['active', 'in_progress', 'done', 'all'] as const
type FilterType = typeof VALID_FILTERS[number]

export default function TasksPage() {
  return (
    <Suspense>
      <TasksPageInner />
    </Suspense>
  )
}

function TasksPageInner() {
  const params = useParams()
  const slug = params.slug as string
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [filter, setFilter] = useState<FilterType>(() => {
    const p = searchParams.get('filter')
    return (VALID_FILTERS.includes(p as FilterType) ? p : 'active') as FilterType
  })
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  useEffect(() => {
    setLoading(true)
    setOffset(0)
    const statusParam = filter === 'active' ? undefined : filter === 'all' ? undefined : filter
    api.tasks
      .list(slug, { ...(statusParam ? { status: statusParam } : {}), limit: PAGE_SIZE, offset: 0 })
      .then(({ tasks: t, hasMore: more }) => {
        const filtered = filter === 'active' ? t.filter((task) => !['done', 'cancelled'].includes(task.status)) : t
        setTasks(filtered)
        setHasMore(more)
      })
      .finally(() => setLoading(false))
  }, [slug, filter])

  async function handleLoadMore() {
    setLoadingMore(true)
    const nextOffset = offset + PAGE_SIZE
    const statusParam = filter === 'active' ? undefined : filter === 'all' ? undefined : filter
    try {
      const { tasks: t, hasMore: more } = await api.tasks.list(slug, {
        ...(statusParam ? { status: statusParam } : {}),
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      const filtered = filter === 'active' ? t.filter((task) => !['done', 'cancelled'].includes(task.status)) : t
      setTasks((prev) => [...prev, ...filtered])
      setHasMore(more)
      setOffset(nextOffset)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load more tasks')
    } finally {
      setLoadingMore(false)
    }
  }

  const filteredTasks = useMemo(() => {
    let result = tasks
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter)
    }
    if (!search.trim()) return result
    const q = search.toLowerCase()
    return result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        t.domain.toLowerCase().includes(q)
    )
  }, [tasks, search, priorityFilter])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const task = await api.tasks.create(slug, { title: newTitle, dueDate: newDueDate || null })
      setTasks((prev) => [task, ...prev])
      setNewTitle('')
      setNewDueDate('')
      setCreating(false)
      toast.success('Task created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task')
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    try {
      const updated = await api.tasks.update(slug, taskId, { status })
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update task')
    }
  }

  function handleTaskUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  function handleTaskDeleted(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold shrink-0">Tasks</h1>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          New task
        </button>
      </div>

      {/* Filters */}
      <div className="border-b border-border px-6 py-2 flex items-center gap-1 flex-wrap">
        {VALID_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilter(s)
              const sp = new URLSearchParams(searchParams.toString())
              if (s === 'active') sp.delete('filter')
              else sp.set('filter', s)
              router.replace(`/w/${slug}/tasks${sp.size ? `?${sp}` : ''}`, { scroll: false })
            }}
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
        <span className="mx-1 text-border">|</span>
        {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((p) => {
          const colors: Record<string, string> = {
            urgent: 'text-red-600 bg-red-50 dark:bg-red-900/20',
            high:   'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
            medium: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
            low:    'text-slate-600 bg-slate-100 dark:bg-slate-800',
          }
          return (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs transition-colors',
                priorityFilter === p
                  ? p === 'all' ? 'bg-primary/10 text-primary font-medium' : cn(colors[p], 'font-medium ring-1 ring-current/20')
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p === 'all' ? 'Any priority' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          )
        })}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {creating && (
          <form onSubmit={handleCreate} className="flex gap-2 flex-wrap">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
            />
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              title="Due date (optional)"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
              Add
            </button>
            <button type="button" onClick={() => { setCreating(false); setNewDueDate('') }} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center space-y-2 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 opacity-20" />
            <p className="text-sm">
              {search ? `No tasks match "${search}"` : 'No tasks yet. Ask your coworker to create some.'}
            </p>
          </div>
        ) : (
          <>
            {filteredTasks.map((task) => {
              const cfg = STATUS_CONFIG[task.status]
              const StatusIcon = cfg.icon
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors group cursor-pointer"
                  onClick={() => setEditingTask(task)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, STATUS_CYCLE[task.status]) }}
                    className={cn('mt-0.5 shrink-0', cfg.color)}
                  >
                    <StatusIcon className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', task.status === 'done' && 'line-through text-muted-foreground')}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[task.priority])}>
                        {task.priority}
                      </span>
                      <span className="text-xs text-muted-foreground">{cfg.label}</span>
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
                    <span className={cn('text-xs font-medium shrink-0', dueDateColor(task.dueDate))}>
                      {task.dueDate.split('T')[0]}
                    </span>
                  )}
                </div>
              )
            })}
            {hasMore && !search.trim() && (
              <div className="pt-2 pb-4 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    `Load more`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {editingTask && (
        <TaskDetailModal
          task={editingTask}
          slug={slug}
          onClose={() => setEditingTask(null)}
          onUpdated={handleTaskUpdated}
          onDeleted={handleTaskDeleted}
        />
      )}
    </div>
  )
}
