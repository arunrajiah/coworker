'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Brain, Trash2, RefreshCw, AlertTriangle, Loader2, FileText, MessageSquare } from 'lucide-react'
import { api, type Memory } from '@/lib/api'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

function sourceIcon(type: string) {
  if (type === 'file') return <FileText className="h-3 w-3" />
  return <MessageSquare className="h-3 w-3" />
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function MemoryPage() {
  const params = useParams()
  const slug = params.slug as string

  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async (off: number, replace: boolean) => {
    setLoading(true)
    try {
      const rows = await api.memories.list(slug, { limit: PAGE_SIZE, offset: off })
      setMemories((prev) => replace ? rows : [...prev, ...rows])
      setHasMore(rows.length === PAGE_SIZE)
      setOffset(off + rows.length)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load(0, true) }, [load])

  async function handleDelete(id: string) {
    setDeletingId(id)
    await api.memories.delete(slug, id).catch(() => {})
    setMemories((prev) => prev.filter((m) => m.id !== id))
    setDeletingId(null)
  }

  async function handleClearAll() {
    setClearing(true)
    await api.memories.deleteAll(slug).catch(() => {})
    setMemories([])
    setHasMore(false)
    setClearConfirm(false)
    setClearing(false)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Memory
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Everything your coworker remembers — drawn from conversations and file uploads
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(0, true)}
              disabled={loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground disabled:opacity-40 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            {memories.length > 0 && !clearConfirm && (
              <button
                onClick={() => setClearConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
            {clearConfirm && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-3 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="text-xs text-red-600 dark:text-red-400">Delete all memories?</span>
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                >
                  {clearing ? 'Clearing…' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setClearConfirm(false)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {memories.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Showing {memories.length}{hasMore ? '+' : ''} memories
          </div>
        )}

        {/* Memory list */}
        {loading && memories.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : memories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">No memories yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Start chatting and your coworker will remember context, facts, and decisions automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="group flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3 hover:border-border/80 transition-colors"
              >
                <div className="shrink-0 mt-0.5 text-muted-foreground">
                  {sourceIcon(memory.sourceType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed line-clamp-3">{memory.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {memory.sourceType}
                    </span>
                    <span className="text-xs text-muted-foreground">{relativeTime(memory.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(memory.id)}
                  disabled={deletingId === memory.id}
                  className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-all disabled:opacity-40"
                  title="Delete this memory"
                >
                  {deletingId === memory.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={() => load(offset, false)}
                disabled={loading}
                className="w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
