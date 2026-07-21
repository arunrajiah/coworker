'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Plus, FileText, Layers, MessageSquare, ChevronRight, Trash2, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { api, type Spec, type SpecType, type SpecStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

const TYPE_CONFIG: Record<SpecType, { label: string; icon: typeof FileText; color: string }> = {
  requirement: { label: 'Requirement', icon: FileText, color: 'text-blue-500' },
  blueprint:   { label: 'Blueprint',   icon: Layers,   color: 'text-purple-500' },
  feedback:    { label: 'Feedback',    icon: MessageSquare, color: 'text-amber-500' },
}

const STATUS_CONFIG: Record<SpecStatus, { label: string; color: string }> = {
  draft:      { label: 'Draft',      color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  active:     { label: 'Active',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  deprecated: { label: 'Deprecated', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

const TYPES: SpecType[] = ['requirement', 'blueprint', 'feedback']
const STATUSES: SpecStatus[] = ['draft', 'active', 'deprecated']

export default function SpecsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [specs, setSpecs] = useState<Spec[]>([])
  const [selected, setSelected] = useState<Spec | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState<SpecType | 'all'>('all')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editType, setEditType] = useState<SpecType>('requirement')
  const [editStatus, setEditStatus] = useState<SpecStatus>('draft')
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.specs.list(slug, filterType === 'all' ? undefined : filterType)
      setSpecs(res.specs)
    } catch {
      toast.error('Failed to load specs')
    } finally {
      setLoading(false)
    }
  }, [slug, filterType])

  useEffect(() => { load() }, [load])

  function open(spec: Spec) {
    setSelected(spec)
    setEditTitle(spec.title)
    setEditContent(spec.content)
    setEditType(spec.type)
    setEditStatus(spec.status)
    setDirty(false)
  }

  async function createSpec() {
    try {
      const spec = await api.specs.create(slug, { title: 'Untitled', type: 'requirement' })
      setSpecs((prev) => [spec, ...prev])
      open(spec)
    } catch {
      toast.error('Failed to create spec')
    }
  }

  async function save() {
    if (!selected || !dirty) return
    setSaving(true)
    try {
      const updated = await api.specs.update(slug, selected.id, {
        title: editTitle,
        content: editContent,
        type: editType,
        status: editStatus,
      })
      setSpecs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      setSelected(updated)
      setDirty(false)
      toast.success('Saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSpec(id: string) {
    try {
      await api.specs.delete(slug, id)
      setSpecs((prev) => prev.filter((s) => s.id !== id))
      if (selected?.id === id) setSelected(null)
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const filtered = filterType === 'all' ? specs : specs.filter((s) => s.type === filterType)

  return (
    <div className="flex h-full">
      {/* Sidebar list */}
      <div className="w-64 border-r border-border flex flex-col shrink-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Specs</h2>
          <button
            onClick={createSpec}
            className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="New spec"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Type filter tabs */}
        <div className="flex gap-1 p-2 border-b border-border">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              'flex-1 text-xs py-1 rounded-md transition-colors',
              filterType === 'all'
                ? 'bg-background shadow-sm text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          {TYPES.map((t) => {
            const { label } = TYPE_CONFIG[t]
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={cn(
                  'flex-1 text-xs py-1 rounded-md transition-colors',
                  filterType === t
                    ? 'bg-background shadow-sm text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label.slice(0, 3)}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No specs yet</p>
          ) : (
            filtered.map((spec) => {
              const { icon: Icon, color } = TYPE_CONFIG[spec.type]
              const { label: statusLabel, color: statusColor } = STATUS_CONFIG[spec.status]
              return (
                <button
                  key={spec.id}
                  onClick={() => open(spec)}
                  className={cn(
                    'w-full text-left px-2 py-2 rounded-lg transition-colors group',
                    selected?.id === spec.id
                      ? 'bg-background shadow-sm'
                      : 'hover:bg-background/60'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{spec.title}</p>
                      <span className={cn('text-[10px] px-1 py-0.5 rounded font-medium', statusColor)}>
                        {statusLabel}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSpec(spec.id) }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a spec or create one</p>
              <button
                onClick={createSpec}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New spec
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
              <input
                className="flex-1 text-base font-semibold bg-transparent outline-none placeholder:text-muted-foreground"
                value={editTitle}
                onChange={(e) => { setEditTitle(e.target.value); setDirty(true) }}
                placeholder="Spec title"
              />
              <select
                value={editType}
                onChange={(e) => { setEditType(e.target.value as SpecType); setDirty(true) }}
                className="text-xs border border-border rounded-md px-2 py-1 bg-background"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
                ))}
              </select>
              <select
                value={editStatus}
                onChange={(e) => { setEditStatus(e.target.value as SpecStatus); setDirty(true) }}
                className="text-xs border border-border rounded-md px-2 py-1 bg-background"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
              <button
                onClick={save}
                disabled={!dirty || saving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  dirty
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
            </div>

            {/* Type + breadcrumb hint */}
            <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground border-b border-border/50 shrink-0">
              {(() => { const { icon: Icon, color, label } = TYPE_CONFIG[editType]; return <><Icon className={cn('h-3 w-3', color)} /><span>{label}</span></> })()}
              <ChevronRight className="h-3 w-3" />
              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', STATUS_CONFIG[editStatus].color)}>
                {STATUS_CONFIG[editStatus].label}
              </span>
            </div>

            {/* Content textarea */}
            <textarea
              className="flex-1 resize-none p-4 text-sm bg-transparent outline-none font-mono leading-relaxed placeholder:text-muted-foreground"
              value={editContent}
              onChange={(e) => { setEditContent(e.target.value); setDirty(true) }}
              placeholder={
                editType === 'requirement'
                  ? '## Overview\n\nDescribe the requirement...\n\n## Acceptance Criteria\n\n- [ ] ...'
                  : editType === 'blueprint'
                  ? '## Architecture\n\nDescribe the design decision...\n\n## Rationale\n\n...'
                  : '## Feedback\n\nPaste raw feedback here...\n\n## Structured Issues\n\n- ...'
              }
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                  e.preventDefault()
                  save()
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
