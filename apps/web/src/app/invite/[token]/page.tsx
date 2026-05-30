'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface InviteDetails {
  email: string
  role: string
  workspaceName: string
  workspaceSlug: string
  expiresAt: string
}

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const authToken = useAuthStore((s) => s.token)

  const [details, setDetails] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    api.workspaces.getInvitation(token)
      .then(setDetails)
      .catch((err) => setError(err instanceof Error ? err.message : 'Invalid or expired invitation'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleAccept() {
    if (!authToken) {
      // Redirect to login, then back to this page
      router.push(`/login?redirect=/invite/${token}`)
      return
    }
    setAccepting(true)
    try {
      const result = await api.workspaces.acceptInvitation(token)
      setAccepted(true)
      setTimeout(() => router.push(`/w/${result.workspaceSlug}`), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Workspace Invitation</h1>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-border p-8 text-center space-y-4">
            <XCircle className="h-12 w-12 text-red-400 mx-auto" />
            <div>
              <p className="font-medium">Invitation unavailable</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <button
              onClick={() => router.push('/workspaces')}
              className="text-sm text-primary hover:underline"
            >
              Go to your workspaces
            </button>
          </div>
        )}

        {!loading && !error && details && !accepted && (
          <div className="rounded-2xl border border-border p-8 space-y-6">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground text-sm">You&apos;ve been invited to join</p>
              <p className="text-xl font-semibold">{details.workspaceName}</p>
              <span className="inline-block text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">
                {details.role}
              </span>
            </div>

            <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm text-center text-muted-foreground">
              This invitation was sent to <strong className="text-foreground">{details.email}</strong>
              {' '}and expires on{' '}
              <strong className="text-foreground">
                {new Date(details.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </strong>.
            </div>

            {!authToken && (
              <p className="text-xs text-center text-muted-foreground">
                You&apos;ll be asked to sign in before accepting.
              </p>
            )}

            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {authToken ? 'Accept invitation' : 'Sign in to accept'}
            </button>
          </div>
        )}

        {accepted && (
          <div className="rounded-2xl border border-border p-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <p className="font-semibold">You&apos;re in!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Taking you to {details?.workspaceName}…
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
