'use client'

import Link from 'next/link'
import { usePathname, useParams, useRouter } from 'next/navigation'
import { MessageSquare, CheckSquare, Moon, Settings, LogOut, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import type { Workspace } from '@/lib/api'
import { FOUNDER_TEMPLATES } from '@coworker/core'
import type { TemplateType } from '@coworker/core'

const TEMPLATE_ICONS: Record<string, string> = {
  saas: '🚀',
  agency: '🎯',
  ecommerce: '🛒',
  consulting: '💼',
  freelancer: '⚡',
  general: '✦',
}

const navItems = [
  { href: 'chat', label: 'Chat', icon: MessageSquare },
  { href: 'tasks', label: 'Tasks', icon: CheckSquare },
  { href: 'autopilot', label: 'Autopilot', icon: Moon },
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

  useEffect(() => {
    api.workspaces.get(slug).then(setWorkspace).catch(() => {})
  }, [slug])

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
          {navItems.map(({ href, label, icon: Icon }) => {
            const fullHref = `/w/${slug}/${href}`
            const active = pathname.startsWith(fullHref)
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
                {label}
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

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{user?.email ?? 'Sign out'}</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
