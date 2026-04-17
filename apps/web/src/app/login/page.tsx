'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'

const LOCAL_AUTH = process.env.NEXT_PUBLIC_LOCAL_AUTH === 'true'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.auth.sendMagicLink(email) as { ok: boolean; token?: string; user?: { id: string; email: string; name: string | null } }
      // LOCAL_AUTH: API returns token + user directly — no email step needed
      if (res.token && res.user) {
        setAuth(res.token, { ...res.user, avatarUrl: null })
        router.replace('/workspaces')
        return
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — value prop */}
      <div className="hidden lg:flex flex-col justify-between bg-foreground text-background p-12">
        <div className="text-xl font-semibold">🤝 Coworker</div>

        <div className="space-y-6 max-w-sm">
          <h1 className="text-4xl font-bold leading-tight">
            The teammate who never sleeps.
          </h1>
          <p className="text-background/70 text-lg leading-relaxed">
            Coworker manages your tasks, remembers every conversation,
            and keeps working on autopilot while you focus on what matters.
          </p>
          <div className="space-y-3 text-sm">
            {[
              'Remembers context across every conversation',
              'Creates and manages tasks on your behalf',
              'Runs automations while you sleep',
              'Knows your business type out of the box',
            ].map((line) => (
              <div key={line} className="flex items-center gap-2 text-background/80">
                <span className="text-primary">✓</span>
                {line}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-background/40">Open source. Self-hostable. Yours.</p>
      </div>

      {/* Right — sign in */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden text-2xl font-semibold text-center">🤝 Coworker</div>

          {sent ? (
            <div className="space-y-4 text-center">
              <div className="text-4xl">📬</div>
              <h2 className="text-xl font-semibold">Check your inbox</h2>
              <p className="text-sm text-muted-foreground">
                We sent a sign-in link to <strong>{email}</strong>.
                The link expires in 15 minutes.
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">Sign in</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {LOCAL_AUTH ? 'Local mode — enter any email to continue.' : 'No password. We\'ll send you a link.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium">
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full rounded-xl bg-foreground text-background py-3 text-sm font-medium hover:bg-foreground/90 disabled:opacity-40 transition-colors"
                >
                  {loading ? 'Signing in…' : LOCAL_AUTH ? 'Sign in →' : 'Send sign-in link →'}
                </button>
              </form>

              <p className="text-xs text-center text-muted-foreground">
                Self-hosting?{' '}
                <a
                  href="https://github.com/your-org/coworker"
                  target="_blank"
                  className="underline hover:text-foreground"
                >
                  Read the docs
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
