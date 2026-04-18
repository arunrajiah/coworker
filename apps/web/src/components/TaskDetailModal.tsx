'use client'

import { useState } from 'react'
import { X, Trash2, Loader2, Bot, GitBranch, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { api, type Task, type TaskStatus, type TaskPriority, type TaskDomain } from '@/lib/api'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const DOMAIN_OPTIONS: { value: TaskDomain; label: string }[] = [
  { value: 'general', label: 'General' },
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

interface TaskDetailModalProps {
  task: Task
  slug: string
  onClose: () => void
  onUpdated: (task: Task) => void
  onDeleted: (taskId: string) => void
}

export function TaskDetailModal({ task, slug, onClose, onUpdated, onDeleted }: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [domain, setDomain] = useState<TaskDomain>(task.domain)
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isDirty =
    title !== task.title ||
    description !== (task.description ?? '') ||
    status !== task.status ||
    priority !== task.priority ||
    domain !== task.domain ||
    dueDate !== (task.dueDate ? task.dueDate.split('T')[0] : '')

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const updated = await api.tasks.update(slug, task.id, {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        domain,
        dueDate: dueDate || null,
      } as Partial<Task>)
      onUpdated(updated)
      toast.success('Task saved')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await api.tasks.delete(slug, task.id)
      onDeleted(task.id)
      toast.success('Task deleted')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task')
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl border border-border shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <span className="text-sm font-medium text-muted-foreground">Edit task</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors rounded p-0.5 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full text-base font-semibold bg-transparent border-0 focus:outline-none placeholder:text-muted-foreground"
          />

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            rows={3}
            className="w-full text-sm bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
          />

          {/* Fields grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Domain</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as TaskDomain)}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {DOMAIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Labels */}
          {task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.labels.map((l) => (
                <span key={l} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{l}</span>
              ))}
            </div>
          )}

          {/* Agent notes */}
          {task.agentNotes && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Bot className="h-3.5 w-3.5" />
                Agent notes
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{task.agentNotes}</p>
            </div>
          )}

          {/* Git info */}
          {task.gitConnectionId && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              {task.gitIssueNumber ? `Linked to issue #${task.gitIssueNumber}` : 'Linked to git'}
            </div>
          )}

          {/* Created at */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-3">
            <Calendar className="h-3.5 w-3.5" />
            Created {new Date(task.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            {task.agentOwned && (
              <span className="flex items-center gap-1 ml-2">
                <Bot className="h-3 w-3" />
                AI task
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={cn(
              'flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5 transition-colors',
              confirmDelete
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
            )}
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {confirmDelete ? 'Confirm delete' : 'Delete'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim() || !isDirty}
              className="flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
