'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Bot, Loader2, ChevronDown, GitBranch } from 'lucide-react'
import { api, type Task, type TaskStatus, type TaskDomain, type BoardColumns } from '@/lib/api'
import { WorkspaceSocket } from '@/lib/ws'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

const COLUMN_ORDER: (keyof BoardColumns)[] = ['backlog', 'todo', 'in_progress', 'review', 'done']

const COLUMN_CONFIG: Record<string, { label: string; color: string; headerColor: string }> = {
  backlog:     { label: 'Backlog',      color: 'border-t-slate-300',   headerColor: 'text-slate-500' },
  todo:        { label: 'Todo',         color: 'border-t-blue-400',    headerColor: 'text-blue-600' },
  in_progress: { label: 'In Progress',  color: 'border-t-yellow-400',  headerColor: 'text-yellow-600' },
  review:      { label: 'Review',       color: 'border-t-purple-400',  headerColor: 'text-purple-600' },
  done:        { label: 'Done',         color: 'border-t-green-400',   headerColor: 'text-green-600' },
}

const DOMAIN_COLORS: Record<string, string> = {
  development: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  qa:          'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  marketing:   'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  finance:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  design:      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  operations:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  hr:          'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  legal:       'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  sales:       'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  general:     'bg-muted text-muted-foreground',
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  medium: 'bg-yellow-400',
  low:    'bg-slate-300',
}

const ALL_DOMAINS: { value: string; label: string }[] = [
  { value: 'all', label: 'All domains' },
  { value: 'development', label: 'Development' },
  { value: 'qa', label: 'QA' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'design', label: 'Design' },
  { value: 'operations', label: 'Operations' },
  { value: 'hr', label: 'HR' },
  { value: 'legal', label: 'Legal' },
  { value: 'sales', label: 'Sales' },
]

type ActiveAgentMap = Record<string, { tools: string[] }>

export default function BoardPage() {
  const params = useParams()
  const slug = params.slug as string
  const token = useAuthStore((s) => s.token)

  const [columns, setColumns] = useState<BoardColumns>({ backlog: [], todo: [], in_progress: [], review: [], done: [] })
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDomain, setActiveDomain] = useState('all')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [agentActivity, setAgentActivity] = useState<ActiveAgentMap>({})
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null)
  const socketRef = useRef<WorkspaceSocket | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const loadBoard = useCallback(async () => {
    const data = await api.tasks.board(slug, activeDomain)
    setColumns(data)
    setLoading(false)
  }, [slug, activeDomain])

  useEffect(() => {
    setLoading(true)
    loadBoard()
  }, [loadBoard])

  useEffect(() => {
    api.workspaces.get(slug).then((ws) => setWorkspaceId(ws.id))
  }, [slug])

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!workspaceId || !token) return
    const socket = new WorkspaceSocket(workspaceId, token)
    socketRef.current = socket
    socket.connect()

    const off = socket.on((event) => {
      if (event.type === 'task:created') {
        const task: Task = event.task
        if (activeDomain !== 'all' && task.domain !== activeDomain) return
        setColumns((prev) => {
          const col = task.status as keyof BoardColumns
          if (!prev[col]) return prev
          const exists = prev[col].some((t) => t.id === task.id)
          if (exists) return prev
          return { ...prev, [col]: [task, ...prev[col]] }
        })
      } else if (event.type === 'task:updated') {
        const task: Task = event.task
        setColumns((prev) => {
          // Remove from all columns, then add to correct one
          const next = { ...prev }
          for (const col of COLUMN_ORDER) {
            next[col] = prev[col].filter((t) => t.id !== task.id)
          }
          const targetCol = task.status as keyof BoardColumns
          if (next[targetCol]) {
            next[targetCol] = [task, ...next[targetCol]]
          }
          return next
        })
      } else if (event.type === 'task:deleted') {
        setColumns((prev) => {
          const next = { ...prev }
          for (const col of COLUMN_ORDER) {
            next[col] = prev[col].filter((t) => t.id !== event.taskId)
          }
          return next
        })
      } else if (event.type === 'agent:thinking') {
        // Mark agent as active — tie to all tasks in the current run
        setAgentActivity((prev) => ({ ...prev, [event.agentRunId]: { tools: [] } }))
      } else if (event.type === 'agent:tool_call') {
        setAgentActivity((prev) => ({
          ...prev,
          [event.agentRunId]: { tools: event.tools },
        }))
      } else if (event.type === 'agent:complete' || event.type === 'agent:error') {
        setAgentActivity((prev) => {
          const next = { ...prev }
          delete next[event.agentRunId]
          return next
        })
      }
    })

    return () => {
      off()
      socket.disconnect()
    }
  }, [workspaceId, token, activeDomain])

  function findTaskColumn(taskId: string): keyof BoardColumns | null {
    for (const col of COLUMN_ORDER) {
      if (columns[col]?.some((t) => t.id === taskId)) return col
    }
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    for (const col of COLUMN_ORDER) {
      const task = columns[col]?.find((t) => t.id === active.id)
      if (task) { setActiveTask(task); break }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const fromCol = findTaskColumn(active.id as string)
    const overIdAsCol = over.id as keyof BoardColumns
    const toCol = COLUMN_ORDER.includes(overIdAsCol) ? overIdAsCol : findTaskColumn(over.id as string)

    if (!fromCol || !toCol || fromCol === toCol) return

    setColumns((prev) => {
      const task = prev[fromCol].find((t) => t.id === active.id)
      if (!task) return prev
      return {
        ...prev,
        [fromCol]: prev[fromCol].filter((t) => t.id !== active.id),
        [toCol]: [{ ...task, status: toCol as TaskStatus }, ...prev[toCol]],
      }
    })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const overIdAsCol = over.id as keyof BoardColumns
    const toCol = COLUMN_ORDER.includes(overIdAsCol) ? overIdAsCol : findTaskColumn(over.id as string)
    if (!toCol) return

    try {
      await api.tasks.update(slug, active.id as string, { status: toCol })
    } catch {
      loadBoard() // Re-fetch on error
    }
  }

  const hasAgentRunning = Object.keys(agentActivity).length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Board header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Board</h1>
          {hasAgentRunning && (
            <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Agent working
            </div>
          )}
        </div>

        {/* Domain filter */}
        <div className="relative">
          <select
            value={activeDomain}
            onChange={(e) => setActiveDomain(e.target.value)}
            className="appearance-none rounded-lg border border-input bg-background pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            {ALL_DOMAINS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-4 h-full px-6 py-4 min-w-max">
              {COLUMN_ORDER.map((status) => (
                <BoardColumn
                  key={status}
                  status={status}
                  tasks={columns[status] ?? []}
                  agentActivity={agentActivity}
                  addingTo={addingTo}
                  onAddStart={() => setAddingTo(status)}
                  onAddCancel={() => setAddingTo(null)}
                  onAddSave={async (title, domain) => {
                    await api.tasks.create(slug, { title, domain, status })
                    setAddingTo(null)
                  }}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeTask && (
              <TaskCard task={activeTask} isDragging agentActivity={agentActivity} />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

// ── BoardColumn ───────────────────────────────────────────────────────────────

function BoardColumn({
  status,
  tasks,
  agentActivity,
  addingTo,
  onAddStart,
  onAddCancel,
  onAddSave,
}: {
  status: TaskStatus
  tasks: Task[]
  agentActivity: ActiveAgentMap
  addingTo: TaskStatus | null
  onAddStart: () => void
  onAddCancel: () => void
  onAddSave: (title: string, domain: TaskDomain) => Promise<void>
}) {
  const config = COLUMN_CONFIG[status]
  const { setNodeRef, isOver } = useSortable({ id: status, data: { type: 'column' } })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-72 rounded-xl border border-border bg-muted/30 transition-colors',
        isOver && 'bg-muted/60 border-primary/30',
        `border-t-2 ${config.color}`
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', config.headerColor)}>{config.label}</span>
          <span className="text-xs bg-background border border-border rounded-full px-1.5 py-0.5 text-muted-foreground font-mono">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAddStart}
          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[120px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} agentActivity={agentActivity} />
          ))}
        </SortableContext>

        {addingTo === status && (
          <AddTaskInline
            onCancel={onAddCancel}
            onSave={onAddSave}
          />
        )}
      </div>
    </div>
  )
}

// ── TaskCard ──────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  isDragging,
  agentActivity,
}: {
  task: Task
  isDragging?: boolean
  agentActivity: ActiveAgentMap
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: task.id })

  // Check if any running agent is working on this task (we watch all tool_calls)
  const activeRuns = Object.entries(agentActivity)
  const agentTools = activeRuns.length > 0 ? activeRuns.flatMap(([, v]) => v.tools) : []
  const isAgentWorking = task.agentOwned && agentTools.some((t) => t.includes('task'))

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group bg-background rounded-lg border border-border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all select-none',
        isDragging && 'shadow-xl rotate-1 opacity-95',
        isAgentWorking && 'ring-2 ring-primary/50 border-primary/30'
      )}
    >
      {/* Agent working indicator */}
      {isAgentWorking && (
        <div className="flex items-center gap-1 mb-2 text-xs text-primary">
          <Bot className="h-3 w-3" />
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1 w-1 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        </div>
      )}

      <p className="text-sm font-medium leading-snug line-clamp-2">{task.title}</p>

      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
      )}

      {task.agentNotes && (
        <div className="mt-2 flex items-start gap-1 text-xs text-muted-foreground border-t border-border pt-2">
          <Bot className="h-3 w-3 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{task.agentNotes}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Domain badge */}
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', DOMAIN_COLORS[task.domain] ?? DOMAIN_COLORS.general)}>
            {task.domain}
          </span>

          {/* Due date */}
          {task.dueDate && (
            <span className="text-xs text-muted-foreground">{formatDate(task.dueDate)}</span>
          )}
        </div>

        {/* Priority dot */}
        <span className={cn('h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[task.priority] ?? 'bg-slate-300')} title={task.priority} />
      </div>

      {/* Bottom badges */}
      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        {task.agentOwned && !isAgentWorking && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Bot className="h-3 w-3" />
            <span>AI task</span>
          </div>
        )}
        {task.gitConnectionId && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            {task.gitIssueNumber ? <span>#{task.gitIssueNumber}</span> : <span>git</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── AddTaskInline ─────────────────────────────────────────────────────────────

function AddTaskInline({
  onCancel,
  onSave,
}: {
  onCancel: () => void
  onSave: (title: string, domain: TaskDomain) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [domain, setDomain] = useState<TaskDomain>('general')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onSave(title.trim(), domain)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} className="bg-background border border-primary/50 rounded-lg p-3 space-y-2 shadow-sm">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title…"
        className="w-full text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      />
      <div className="flex items-center gap-2">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value as TaskDomain)}
          className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {ALL_DOMAINS.filter((d) => d.value !== 'all').map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="rounded px-2 py-1 bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
