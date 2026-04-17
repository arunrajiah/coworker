'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export default function VerifyPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setError('Missing token')
      return
    }

    api.auth
      .verifyMagicLink(token)
      .then(({ token: jwt, user }) => {
        setAuth(jwt, { ...user, avatarUrl: null })
        router.replace('/workspaces')
      })
      .catch((err) => {
        setStatus('error')
        setError(err.message)
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      {status === 'loading' ? (
        <p className="text-muted-foreground text-sm">Signing you in...</p>
      ) : (
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Sign-in failed</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a href="/login" className="text-sm text-primary underline">
            Try again
          </a>
        </div>
      )}
    </div>
  )
}
