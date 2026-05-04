'use client'

import Link from 'next/link'
import { usePathname, useParams, useRouter } from 'next/navigation'
import { MessageSquare, CheckSquare, Moon, Settings, LogOut, ChevronDown, Kanban, LayoutDashboard, Sparkles, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { useState, useEffect, useCallback } from 'react'
import type { Workspace, Task } from '@/lib/api'
import { FOUNDER_TEMPLATES } from '@coworker/core'
import type { TemplateType } from '@coworker/core'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { WorkspaceSocket } from '@/lib/ws'

const TEMPLATE_ICONS: Record<string, string> = {
  saas: '🚀',
  agency: '🎯',
  ecommerce: '🛒',
  consulting: '💼',
  freelancer: '⚡',
  general: '✦',
}

const navItems = [
  { href: '', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: 'board', label: 'Board', icon: Kanban },
  { href: 'chat', label: 'Chat', icon: MessageSquare },
  { href: 'tasks', label: 'Tasks', icon: CheckSquare },
  { href: 'autopilot', label: 'Autopilot', icon: Moon },
  { href: 'skills', label: 'Skills', icon: Sparkles },
  { href: 'settings', label: 'Settings', icon: Settings },
]

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const { user, clearAuth } = useAuthStore()

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [activeTaskCount, setActiveTaskCount] = useState<number | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const token = useAuthStore((s) => s.token)

  const refreshTaskCount = useCallback(() => {
    api.tasks.list(slug, { limit: 100, offset: 0 }).then(({ tasks }) => {
      const active = tasks.filter((t) => !['done', 'cancelled'].includes(t.status))
      setActiveTaskCount(active.length)
    }).catch(() => {})
  }, [slug])

  useEffect(() => {
    api.workspaces.get(slug).then((ws) => { setWorkspace(ws); setWorkspaceId(ws.id) }).catch(() => {})
    refreshTaskCount()
  }, [slug, refreshTaskCount])

  // Refresh badge count on real-time task events
  useEffect(() => {
    if (!workspaceId || !token) return
    const socket = new WorkspaceSocket(workspaceId, token)
    socket.connect()
    const off = socket.on((event) => {
      if (event.type === 'task:created' || event.type === 'task:updated' || event.type === 'task:deleted') {
        // Optimistic update for task:created / task:updated without refetch
        setActiveTaskCount((prev) => {
          if (prev === null) return prev
          if (event.type === 'task:created') {
            const t = event.task as Task
            return ['done', 'cancelled'].includes(t.status) ? prev : prev + 1
          }
          if (event.type === 'task:deleted') return Math.max(0, prev - 1)
          return prev
        })
        // For updates (status change), do a lightweight refetch
        if (event.type === 'task:updated') refreshTaskCount()
      }
    })
    return () => { off(); socket.disconnect() }
  }, [workspaceId, token, refreshTaskCount])

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const handleCmdK = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      router.push(`/w/${slug}/chat/new`)
    }
  }, [router, slug])

  useEffect(() => {
    window.addEventListener('keydown', handleCmdK)
    return () => window.removeEventListener('keydown', handleCmdK)
  }, [handleCmdK])

  async function handleSignOut() {
    await api.auth.signOut()
    clearAuth()
    router.replace('/login')
  }

  const templateIcon = workspace ? (TEMPLATE_ICONS[workspace.templateType] ?? '✦') : '✦'
  const templateName = workspace
    ? FOUNDER_TEMPLATES[workspace.templateType as TemplateType]?.name ?? workspace.templateType
    : ''

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 border-r border-border flex flex-col shrink-0 bg-muted/20">

        {/* Workspace identity */}
        <div className="px-3 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="text-xl leading-none">{templateIcon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{workspace?.name ?? '…'}</p>
              <p className="text-xs text-muted-foreground">{templateName}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const fullHref = href ? `/w/${slug}/${href}` : `/w/${slug}`
            const active = exact ? pathname === fullHref : pathname.startsWith(`/w/${slug}/${href}`)
            return (
              <Link
                key={href}
                href={fullHref}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-background shadow-sm text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {label === 'Tasks' && activeTaskCount !== null && activeTaskCount > 0 && (
                  <span className="ml-auto text-[10px] font-medium leading-none px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    {activeTaskCount > 99 ? '99+' : activeTaskCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User / switch workspace */}
        <div className="p-2 border-t border-border space-y-0.5">
          <Link
            href="/workspaces"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-90" />
            Switch workspace
          </Link>

          <div className="flex items-center gap-1">
            <button
              onClick={handleSignOut}
              className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{user?.email ?? 'Sign out'}</span>
            </button>
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors shrink-0"
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  )
}
