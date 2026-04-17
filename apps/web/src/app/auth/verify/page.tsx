import { Suspense } from 'react'
import { VerifyClient } from './verify-client'

export const dynamic = 'force-dynamic'

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Signing you in...</p>
        </div>
      }
    >
      <VerifyClient />
    </Suspense>
  )
}
